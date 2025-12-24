// ============================================================================
// AUTHPROXY - STATS WATCHER MODULE
// Monitors game database for match completions and triggers webhooks
// ============================================================================

import { PrismaClient } from '@prisma/client';
import Logger from './logger';
import { TrophyWebhook } from './webhooks-trophy';
import { MetArenaWebhook } from './webhooks-metarena';

const log = new Logger();

export interface StatsWatcherConfig {
    enabled: boolean;
    gameDbUrl: string;
    pollIntervalMs: number;
}

interface PlayerStats {
    wins: number;
    mvps: number;
    total_games_played: number;
    current_mmr: number;
    win_streak: number;
}

interface CachedPlayer {
    stats: PlayerStats;
    odinalId: string;
    username: string;
    publisherUsername: string;
    playlistGuid: string;
    matchFlow: number;
    lastSeen: Date;
}

export class StatsWatcher {
    private config: StatsWatcherConfig;
    private gamePrisma: PrismaClient | null = null;
    private playerCache: Map<string, CachedPlayer> = new Map();
    private pollInterval: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private trophyWebhook: TrophyWebhook | null;
    private metarenaWebhook: MetArenaWebhook | null;

    constructor(
        config: StatsWatcherConfig,
        trophyWebhook: TrophyWebhook | null = null,
        metarenaWebhook: MetArenaWebhook | null = null
    ) {
        this.config = config;
        this.trophyWebhook = trophyWebhook;
        this.metarenaWebhook = metarenaWebhook;
    }

    async start(): Promise<boolean> {
        if (!this.config.enabled) {
            log.info('[StatsWatcher] Disabled in config');
            return false;
        }

        if (this.isRunning) {
            log.warn('[StatsWatcher] Already running');
            return true;
        }

        log.info('[StatsWatcher] Starting...');
        log.info(`[StatsWatcher] Game DB: ${this.config.gameDbUrl.replace(/:[^:@]+@/, ':****@')}`);
        log.info(`[StatsWatcher] Poll interval: ${this.config.pollIntervalMs}ms`);
        log.info(`[StatsWatcher] Trophy webhook: ${this.trophyWebhook ? 'enabled' : 'disabled'}`);
        log.info(`[StatsWatcher] MetArena webhook: ${this.metarenaWebhook ? 'enabled' : 'disabled'}`);

        try {
            this.gamePrisma = new PrismaClient({
                datasources: {
                    db: { url: this.config.gameDbUrl }
                }
            });
            await this.gamePrisma.$connect();
            log.info('[StatsWatcher] Connected to game database');
        } catch (error: any) {
            log.err(`[StatsWatcher] Failed to connect to game database: ${error.message}`);
            return false;
        }

        await this.populateCache();

        this.pollInterval = setInterval(() => {
            this.checkForStatChanges();
        }, this.config.pollIntervalMs);

        this.isRunning = true;
        log.info(`[StatsWatcher] Running. Tracking ${this.playerCache.size} player records`);
        return true;
    }

    async stop(): Promise<void> {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        if (this.gamePrisma) {
            await this.gamePrisma.$disconnect();
            this.gamePrisma = null;
        }
        this.isRunning = false;
        log.info('[StatsWatcher] Stopped');
    }

    private async populateCache(): Promise<void> {
        if (!this.gamePrisma) return;

        try {
            const skills = await this.gamePrisma.skill.findMany({
                include: {
                    users: {
                        select: { id: true, username: true, publisher_username: true }
                    }
                }
            });

            for (const skill of skills) {
                const cacheKey = `${skill.user_id}-${skill.playlist_guid}-${skill.match_flow}`;
                
                this.playerCache.set(cacheKey, {
                    stats: {
                        wins: skill.wins || 0,
                        mvps: skill.mvps || 0,
                        total_games_played: skill.total_games_played || 0,
                        current_mmr: skill.current_mmr || 2500,
                        win_streak: skill.win_streak || 0
                    },
                    odinalId: skill.user_id.toString(),
                    username: skill.users.username,
                    publisherUsername: skill.users.publisher_username,
                    playlistGuid: skill.playlist_guid,
                    matchFlow: skill.match_flow,
                    lastSeen: new Date()
                });
            }
        } catch (error: any) {
            log.err(`[StatsWatcher] Failed to populate cache: ${error.message}`);
        }
    }

    private async checkForStatChanges(): Promise<void> {
        if (!this.gamePrisma) return;

        try {
            const skills = await this.gamePrisma.skill.findMany({
                include: {
                    users: {
                        select: { id: true, username: true, publisher_username: true }
                    }
                }
            });

            for (const skill of skills) {
                const cacheKey = `${skill.user_id}-${skill.playlist_guid}-${skill.match_flow}`;
                
                const currentStats: PlayerStats = {
                    wins: skill.wins || 0,
                    mvps: skill.mvps || 0,
                    total_games_played: skill.total_games_played || 0,
                    current_mmr: skill.current_mmr || 2500,
                    win_streak: skill.win_streak || 0
                };

                const cached = this.playerCache.get(cacheKey);
                
                if (cached && currentStats.total_games_played > cached.stats.total_games_played) {
                    await this.onMatchCompleted(cached, currentStats, skill.playlist_guid);
                }

                this.playerCache.set(cacheKey, {
                    stats: currentStats,
                    odinalId: skill.user_id.toString(),
                    username: skill.users.username,
                    publisherUsername: skill.users.publisher_username,
                    playlistGuid: skill.playlist_guid,
                    matchFlow: skill.match_flow,
                    lastSeen: new Date()
                });
            }
        } catch (error: any) {
            log.err(`[StatsWatcher] Poll error: ${error.message}`);
        }
    }

    private async onMatchCompleted(cached: CachedPlayer, current: PlayerStats, playlistGuid: string): Promise<void> {
        const winsGained = current.wins - cached.stats.wins;
        const mvpsGained = current.mvps - cached.stats.mvps;
        const mmrChange = current.current_mmr - cached.stats.current_mmr;
        const won = winsGained > 0;

        log.info(`[StatsWatcher] ========================================`);
        log.info(`[StatsWatcher] MATCH COMPLETED: ${cached.username}`);
        log.info(`[StatsWatcher] Result: ${won ? 'WIN' : 'LOSS'}`);
        log.info(`[StatsWatcher] MVP: ${mvpsGained > 0 ? 'YES' : 'NO'}`);
        log.info(`[StatsWatcher] MMR: ${mmrChange >= 0 ? '+' : ''}${mmrChange} (${current.current_mmr})`);
        log.info(`[StatsWatcher] Win Streak: ${current.win_streak}`);
        log.info(`[StatsWatcher] ========================================`);

        // Send to Trophy
        if (this.trophyWebhook) {
            await this.trophyWebhook.sendMatchComplete({
                odinalId: cached.odinalId,
                username: cached.username,
                won,
                isMvp: mvpsGained > 0,
                mmrChange,
                newMmr: current.current_mmr,
                winStreak: current.win_streak,
                playlistGuid
            });
        }

        // Send to MetArena
        if (this.metarenaWebhook) {
            await this.metarenaWebhook.sendMatchComplete({
                odinalId: cached.odinalId,
                username: cached.username,
                won,
                isMvp: mvpsGained > 0,
                mmrChange,
                newMmr: current.current_mmr,
                winStreak: current.win_streak,
                playlistGuid
            });
        }

        // Check achievements
        await this.checkAchievements(cached, current);
    }

    private async checkAchievements(cached: CachedPlayer, current: PlayerStats): Promise<void> {
        const prev = cached.stats;
        const achievements: Array<{id: string; name: string; description: string}> = [];

        if (prev.total_games_played === 0 && current.total_games_played >= 1) {
            achievements.push({ id: 'first_game', name: 'Welcome to the Streets', description: 'Play your first match' });
        }

        if (prev.wins === 0 && current.wins >= 1) {
            achievements.push({ id: 'first_win', name: 'First Victory', description: 'Win your first match' });
        }

        for (const m of [10, 25, 50, 100, 250, 500, 1000]) {
            if (prev.wins < m && current.wins >= m) {
                achievements.push({ id: `wins_${m}`, name: `${m} Wins`, description: `Win ${m} matches` });
            }
        }

        for (const m of [1, 10, 25, 50, 100]) {
            if (prev.mvps < m && current.mvps >= m) {
                achievements.push({ id: `mvps_${m}`, name: m === 1 ? 'First MVP' : `${m} MVPs`, description: m === 1 ? 'Earn your first MVP' : `Earn ${m} MVP awards` });
            }
        }

        for (const m of [3, 5, 10, 20]) {
            if (prev.win_streak < m && current.win_streak >= m) {
                achievements.push({ id: `streak_${m}`, name: `${m} Win Streak`, description: `Win ${m} matches in a row` });
            }
        }

        for (const m of [3000, 3500, 4000, 4500, 5000]) {
            if (prev.current_mmr < m && current.current_mmr >= m) {
                achievements.push({ id: `mmr_${m}`, name: `${m} MMR`, description: `Reach ${m} MMR` });
            }
        }

        for (const achievement of achievements) {
            log.info(`[StatsWatcher] 🏆 ACHIEVEMENT: ${cached.username} - ${achievement.name}`);
            
            if (this.trophyWebhook) {
                await this.trophyWebhook.sendAchievement({
                    odinalId: cached.odinalId,
                    username: cached.username,
                    achievementId: achievement.id,
                    achievementName: achievement.name,
                    achievementDescription: achievement.description
                });
            }

            if (this.metarenaWebhook) {
                await this.metarenaWebhook.sendAchievement({
                    odinalId: cached.odinalId,
                    username: cached.username,
                    achievementId: achievement.id,
                    achievementName: achievement.name,
                    achievementDescription: achievement.description
                });
            }
        }
    }

    getStatus(): { running: boolean; playerCount: number } {
        return {
            running: this.isRunning,
            playerCount: this.playerCache.size
        };
    }
}

export default StatsWatcher;
