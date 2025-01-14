/*
Author: Kaspar Etter (https://kasparetter.com/)
Work: Explained from First Principles (https://ef1p.com/)
License: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
*/

import { fetchWithErrorAndTimeout } from '../utility/fetch';

/* ------------------------------ IP Info API ------------------------------ */

const token = 'ba0234c01f79d3';
const endpoint = 'https://ipinfo.io/';

export interface IpInfoResponse {
    ip: string;
}

export interface BogonIpInfoResponse extends IpInfoResponse {
    bogon: boolean;
}

export interface SuccessfulIpInfoResponse extends IpInfoResponse {
    city: string;
    country: string;
    hostname?: string;
    loc: string;
    org?: string;
    postal: string;
    region: string;
    timezone: string;
}

export function isSuccessfulIpInfoResponse(response: IpInfoResponse): response is SuccessfulIpInfoResponse {
    return (response as SuccessfulIpInfoResponse).city !== undefined;
}

export async function getIpInfo(ipAddress?: string): Promise<IpInfoResponse> {
    const response = await fetchWithErrorAndTimeout(endpoint + (ipAddress ?? 'json') + '?token=' + token);
    return response.json();
}
