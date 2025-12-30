// ============================================================================
// AUTHPROXY - METARENA WEBHOOK MODULE
// Sends match events to MetArena for tournament bracket updates and KPI tracking
// ============================================================================

import crypto from 'crypto';
import axios from 'axios';
import Logger from './logger';

const log = new Logger();

export interface MetArenaConfig {
    enabled: boolean;
    url: string;
    secret: string;
    serverId: string;
    serverName: string;
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

export class MetArenaWebhook {
    private config: MetArenaConfig;

    constructor(config: MetArenaConfig) {
        this.config = config;
        if (config.enabled) {
            log.info('[MetArena] Webhook enabled');
            log.info(`[MetArena] Endpoint: ${config.url}`);
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
            server_id: this.config.serverId,
            server_name: this.config.serverName,
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
            log.info(`[MetArena] Sent ${event}: ${response.status}`);
            return true;
        } catch (error: any) {
            log.err(`[MetArena] Failed to send ${event}: ${error.message}`);
            return false;
        }
    }

    async sendMatchComplete(data: MatchCompleteData): Promise<void> {
        await this.send('match.completed', {
            // Player identification
            identifier: data.odinalId,
            odinalId: data.odinalId,  // Include both for compatibility
            display_name: data.username,
            username: data.username,
            
            // Match result
            won: data.won,
            is_mvp: data.isMvp,
            isMvp: data.isMvp,  // Include both for compatibility
            mmr_change: data.mmrChange,
            mmrChange: data.mmrChange,
            new_mmr: data.newMmr,
            newMmr: data.newMmr,
            win_streak: data.winStreak,
            winStreak: data.winStreak,
            playlist_guid: data.playlistGuid,
            playlistGuid: data.playlistGuid,
            
            // NEW: Per-match KPIs for tournament scoring
            kpis: data.kpis || {
                kos: 0,
                raw_kos: 0,
                special_kos: 0,
                double_kos: 0,
                triple_kos: 0,
                ultimate_kos: 0,
                death_from_above: 0,
                passes: 0,
                curve_passes: 0,
                lob_passes: 0,
                catches: 0,
                perfect_catches: 0,
                assists: 0,
                ballform_kos: 0,
                frenzy_kos: 0
            },
            
            // NEW: Cumulative player stats
            cumulativeStats: data.cumulativeStats || {
                total_games: 0,
                total_wins: 0,
                total_mvps: 0,
                total_kos: 0,
                total_passes: 0,
                total_catches: 0,
                total_assists: 0
            }
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

    async sendPlayerConnected(odinalId: string, username: string, velanId: number): Promise<void> {
        await this.send('player.connected', {
            identifier: odinalId,
            display_name: username,
            velan_id: velanId,
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

export default MetArenaWebhook;
