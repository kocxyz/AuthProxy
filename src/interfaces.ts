import { AxiosResponse, AxiosError } from 'axios';


/**
 * Represents the configuration object for the proxy server.
 */
export interface config {
    name: string, // The name of the server.
    authServer: string, // The URL of the authentication server.
    publicAddr: string, // The public address of the server.
    maxPlayers: number, // The maximum number of players allowed on the server.
    external: {
        port: number, // The external port of the server.
    },
    internal: {
        host: string, // The internal host of the server.
        port: number, // The internal port of the server.
    },
}

/**
 * Represents the data returned by an authentication error.
 */
export interface authErrorData {
    type: string, // The type of the authentication error.
    message: string, // The error message.
}

/**
 * Represents the response object returned by a successful authentication request.
 */
export interface authResponse extends AxiosResponse {
    data: {
        username: string // The username of the authenticated user.
    }
}

/**
 * Represents the error object returned by a failed authentication request.
 */
export interface authError extends AxiosError {
    response?: AxiosResponse<unknown, any> & {
        data?: authErrorData // The data returned by the authentication error.
    }
}

