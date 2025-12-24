// ============================================================================
// AUTHPROXY - METARENA WEBHOOK MODULE
// Sends match events to MetArena for tournament tracking
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
        if (!this.config.secret) return '';
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
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'X-KOCity-Event': event,
                'User-Agent': 'KOCity-AuthProxy/1.0'
            };
            
            if (signature) {
                headers['X-KOCity-Signature'] = signature;
            }

            const response = await axios.post(this.config.url, payload, {
                headers,
                timeout: 10000
            });
            log.info(`[MetArena] Sent ${event}: ${response.status}`);
            return true;
        } catch (error: any) {
            log.err(`[MetArena] Failed to send ${event}: ${error.message}`);
            return false;
        }
    }

    async sendMatchComplete(data: {
        odinalId: string;
        username: string;
        won: boolean;
        isMvp: boolean;
        mmrChange: number;
        newMmr: number;
        winStreak: number;
        playlistGuid: string;
    }): Promise<void> {
        await this.send('match.completed', {
            match_id: `koc_${Date.now()}`,
            identifier: data.odinalId,
            display_name: data.username,
            winning_team: data.won ? 1 : 2,
            team1_score: data.won ? 10 : 0,
            team2_score: data.won ? 0 : 10,
            team1_players: [{ identifier: data.odinalId, display_name: data.username }],
            team2_players: [],
            playlist_guid: data.playlistGuid,
            mmr_change: data.mmrChange,
            new_mmr: data.newMmr
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
