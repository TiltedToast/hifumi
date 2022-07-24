export interface ConvertResponse {
    result: string;
    documentation: string;
    terms_of_use: string;
    time_zone: string;
    time_last_update: number;
    time_next_update: number;
    base: string;
    conversion_rates: {
        [currency: string]: number;
    };
}
