export interface ConvertResponse {
    result: "success" | "error";
    documentation?: string;
    terms_of_use?: string;
    time_zone?: string;
    time_last_update?: number;
    time_next_update?: number;
    base?: string;
    "error-type"?: string;
    conversion_rates?: {
        [currency: string]: number;
    };
}
