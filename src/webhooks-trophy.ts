// ============================================================================
// AUTHPROXY - TROPHY WEBHOOK MODULE
// Sends match events to Trophy for achievement tracking and sponsorships
// ============================================================================

import crypto from 'crypto';
import axios from 'axios';
import Logger from './logger';

const log = new Logger();

export interface TrophyConfig {
    enabled: boolean;
    url: string;
    secret: string;
    gameSlug: string;
}

// KPI data structure from StatsWatcher
export interface MatchKPIs {
    kos: number;
    raw_kos: number;
    special_kos: number;
    double_kos: number;
    triple_kos: number;
    ultimate_kos: number;
    death_from_above: number;
    passes: number;
    curve_passes: number;
    lob_passes: number;
    catches: number;
    perfect_catches: number;
    assists: number;
    ballform_kos: number;
    frenzy_kos: number;
}

export interface CumulativeStats {
    total_games: number;
    total_wins: number;
    total_mvps: number;
    total_kos: number;
    total_passes: number;
    total_catches: number;
    total_assists: number;
}

export interface MatchCompleteData {
    odinalId: string;
    username: string;
    won: boolean;
    isMvp: boolean;
    mmrChange: number;
    newMmr: number;
    winStreak: number;
    playlistGuid: string;
    kpis?: MatchKPIs;
    cumulativeStats?: CumulativeStats;
}

export class TrophyWebhook {
    private config: TrophyConfig;

    constructor(config: TrophyConfig) {
        this.config = config;
        if (config.enabled) {
            log.info('[Trophy] Webhook enabled');
            log.info(`[Trophy] Endpoint: ${config.url}`);
        }
    }

    private generateSignature(payload: string): string {
        return crypto
            .createHmac('sha256', this.config.secret)
            .update(payload)
            .digest('hex');
    }

    private async send(event: string, data: any): Promise<boolean> {
        if (!this.config.enabled) return false;

        const payload = JSON.stringify({
            event,
            timestamp: new Date().toISOString(),
            game_slug: this.config.gameSlug,
            data
        });

        const signature = this.generateSignature(payload);

        try {
            const response = await axios.post(this.config.url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-KOCity-Signature': signature,
                    'X-KOCity-Event': event,
                    'User-Agent': 'KOCity-AuthProxy/1.0'
                },
                timeout: 10000
            });
            log.info(`[Trophy] Sent ${event}: ${response.status}`);
            return true;
        } catch (error: any) {
            log.err(`[Trophy] Failed to send ${event}: ${error.message}`);
            return false;
        }
    }

    async sendMatchComplete(data: MatchCompleteData): Promise<void> {
        const player = { 
            identifier: data.odinalId, 
            display_name: data.username 
        };

        await this.send('match.completed', {
            match_id: `koc_${Date.now()}`,
            
            // Player info
            identifier: data.odinalId,
            display_name: data.username,
            
            // Match result
            won: data.won,
            is_mvp: data.isMvp,
            mmr_change: data.mmrChange,
            new_mmr: data.newMmr,
            win_streak: data.winStreak,
            playlist_guid: data.playlistGuid,
            
            // Legacy format for backward compatibility
            winning_team: data.won ? 1 : 2,
            team1_score: data.won ? 10 : 0,
            team2_score: data.won ? 0 : 10,
            team1_players: data.won ? [player] : [],
            team2_players: data.won ? [] : [player],
            duration_seconds: 180,
            was_perfect_game: false,
            was_comeback: false,
            
            // NEW: Detailed KPIs
            kpis: data.kpis || {},
            
            // NEW: Cumulative stats
            cumulative_stats: data.cumulativeStats || {}
        });
    }

    async sendAchievement(data: {
        odinalId: string;
        username: string;
        achievementId: string;
        achievementName: string;
        achievementDescription: string;
    }): Promise<void> {
        await this.send('achievement.unlocked', {
            identifier: data.odinalId,
            display_name: data.username,
            achievement_id: data.achievementId,
            achievement_name: data.achievementName,
            achievement_description: data.achievementDescription
        });
    }

    async sendPlayerConnected(odinalId: string, username: string): Promise<void> {
        await this.send('player.connected', {
            identifier: odinalId,
            display_name: username,
            connected_at: new Date().toISOString()
        });
    }

    async sendPlayerDisconnected(odinalId: string, username: string, sessionSeconds: number): Promise<void> {
        await this.send('player.disconnected', {
            identifier: odinalId,
            display_name: username,
            session_duration_seconds: sessionSeconds,
            disconnected_at: new Date().toISOString()
        });
    }
}

export default TrophyWebhook;
