// ============================================================================
// AUTHPROXY - TROPHY WEBHOOK MODULE
// Sends match events to Trophy Platform for achievement tracking
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
            game_slug: this.config.gameSlug,
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
            log.info(`[Trophy] Sent ${event}: ${response.status}`);
            return true;
        } catch (error: any) {
            log.err(`[Trophy] Failed to send ${event}: ${error.message}`);
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
        const player = { identifier: data.odinalId, display_name: data.username };
        
        await this.send('match.completed', {
            match_id: `koc_${Date.now()}`,
            winning_team: data.won ? 1 : 2,
            team1_score: data.won ? 10 : 0,
            team2_score: data.won ? 0 : 10,
            team1_players: data.won ? [player] : [],
            team2_players: data.won ? [] : [player],
            duration_seconds: 180,
            was_perfect_game: false,
            was_comeback: false
        });
    }

    async sendAchievement(data: {
        odinalId: string;
        username: string;
        achievementId: string;
        achievementName: string;
        achievementDescription: string;
    }): Promise<void> {
        await this.send('player.milestone', {
            identifier: data.odinalId,
            display_name: data.username,
            milestone_type: data.achievementId,
            value: data.achievementName,
            metadata: {
                description: data.achievementDescription
            }
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
