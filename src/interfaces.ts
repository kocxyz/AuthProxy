import { AxiosResponse, AxiosError } from 'axios';
/**
 * Represents the configuration object for the proxy server.
 */
export interface config {
    /** The name of the server. */
    name: string,
    /** The URL of the authentication server. */
    authServer: string,
    /** The public address of the server. */
    publicAddr: string,
    /** The maximum number of players allowed on the server. */
    maxPlayers: number,
    external: {
        /** The port number for external connections. */
        port: number,
    },
    internal: {
        /** The host name for internal connections. */
        host: string,
        /** The port number for internal connections. */
        port: number,
    },
    redis: {
        /** The host name for the Redis server. */
        host: string,
        /** The port number for the Redis server. */
        port: number,
        /** The password for the Redis server. */
        password?: string,
    },
    postgres: string,
    /** Stats Watcher configuration */
    statsWatcher: {
        enabled: boolean,
        gameDbUrl: string,
        pollIntervalMs: number,
    },
    /** Trophy Platform webhook configuration */
    trophy: {
        enabled: boolean,
        url: string,
        secret: string,
        gameSlug: string,
    },
    /** MetArena webhook configuration */
    metarena: {
        enabled: boolean,
        url: string,
        secret: string,
        serverId: string,
        serverName: string,
    },
}
/**
 * Represents the data returned by an authentication error.
 */
export interface authErrorData {
    /** The type of the authentication error. */
    type: string,
    /** The error message. */
    message: string,
}
/**
 * Represents the response object returned by a successful authentication request.
 */
export interface authResponse extends AxiosResponse {
    data: {
        /** The username of the authenticated user. */
        username: string,
        /** The custom username color. */
        color?: string,
        /** The Velan ID connected to the user on this server. */
        velanID?: number,
    }
}
/**
 * Represents an authentication error that extends the AxiosError interface.
 */
export interface authError extends AxiosError {
    response?: AxiosResponse<unknown, any> & {
        /** The data returned by the authentication error. */
        data?: authErrorData
    }
}
