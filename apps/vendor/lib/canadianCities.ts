export interface CanadianCity {
  name: string;
  province: string;
  lat: number;
  lng: number;
}

export const CANADIAN_CITIES: CanadianCity[] = [
  // Ontario
  { name: "Toronto",       province: "ON", lat: 43.6532,  lng: -79.3832  },
  { name: "Scarborough",   province: "ON", lat: 43.7764,  lng: -79.2318  },
  { name: "Mississauga",   province: "ON", lat: 43.5890,  lng: -79.6441  },
  { name: "Brampton",      province: "ON", lat: 43.7315,  lng: -79.7624  },
  { name: "Markham",       province: "ON", lat: 43.8561,  lng: -79.3370  },
  { name: "Vaughan",       province: "ON", lat: 43.8361,  lng: -79.4985  },
  { name: "Richmond Hill", province: "ON", lat: 43.8828,  lng: -79.4403  },
  { name: "Oakville",      province: "ON", lat: 43.4675,  lng: -79.6877  },
  { name: "Burlington",    province: "ON", lat: 43.3255,  lng: -79.7990  },
  { name: "Hamilton",      province: "ON", lat: 43.2557,  lng: -79.8711  },
  { name: "Whitby",        province: "ON", lat: 43.8975,  lng: -78.9429  },
  { name: "Oshawa",        province: "ON", lat: 43.8971,  lng: -78.8658  },
  { name: "Ajax",          province: "ON", lat: 43.8509,  lng: -79.0204  },
  { name: "Pickering",     province: "ON", lat: 43.8384,  lng: -79.0868  },
  { name: "Newmarket",     province: "ON", lat: 44.0592,  lng: -79.4613  },
  { name: "Barrie",        province: "ON", lat: 44.3894,  lng: -79.6903  },
  { name: "Kitchener",     province: "ON", lat: 43.4516,  lng: -80.4925  },
  { name: "Waterloo",      province: "ON", lat: 43.4668,  lng: -80.5164  },
  { name: "Cambridge",     province: "ON", lat: 43.3616,  lng: -80.3144  },
  { name: "London",        province: "ON", lat: 42.9849,  lng: -81.2453  },
  { name: "Windsor",       province: "ON", lat: 42.3149,  lng: -83.0364  },
  { name: "Ottawa",        province: "ON", lat: 45.4215,  lng: -75.6972  },
  { name: "Kingston",      province: "ON", lat: 44.2312,  lng: -76.4860  },
  { name: "Sudbury",       province: "ON", lat: 46.4917,  lng: -80.9930  },
  { name: "Thunder Bay",   province: "ON", lat: 48.3809,  lng: -89.2477  },

  // Quebec
  { name: "Montreal",      province: "QC", lat: 45.5017,  lng: -73.5673  },
  { name: "Quebec City",   province: "QC", lat: 46.8139,  lng: -71.2080  },
  { name: "Laval",         province: "QC", lat: 45.6066,  lng: -73.7124  },
  { name: "Longueuil",     province: "QC", lat: 45.5312,  lng: -73.5185  },
  { name: "Gatineau",      province: "QC", lat: 45.4765,  lng: -75.7013  },
  { name: "Sherbrooke",    province: "QC", lat: 45.4042,  lng: -71.8929  },
  { name: "Saguenay",      province: "QC", lat: 48.4284,  lng: -71.0537  },
  { name: "Trois-Rivieres",province: "QC", lat: 46.3432,  lng: -72.5418  },

  // British Columbia
  { name: "Vancouver",     province: "BC", lat: 49.2827,  lng: -123.1207 },
  { name: "Surrey",        province: "BC", lat: 49.1913,  lng: -122.8490 },
  { name: "Burnaby",       province: "BC", lat: 49.2488,  lng: -122.9805 },
  { name: "Richmond",      province: "BC", lat: 49.1666,  lng: -123.1336 },
  { name: "Kelowna",       province: "BC", lat: 49.8880,  lng: -119.4960 },
  { name: "Abbotsford",    province: "BC", lat: 49.0504,  lng: -122.3045 },
  { name: "Coquitlam",     province: "BC", lat: 49.2838,  lng: -122.7932 },
  { name: "Victoria",      province: "BC", lat: 48.4284,  lng: -123.3656 },

  // Alberta
  { name: "Calgary",       province: "AB", lat: 51.0447,  lng: -114.0719 },
  { name: "Edmonton",      province: "AB", lat: 53.5461,  lng: -113.4938 },
  { name: "Red Deer",      province: "AB", lat: 52.2681,  lng: -113.8112 },
  { name: "Lethbridge",    province: "AB", lat: 49.6956,  lng: -112.8451 },
  { name: "Medicine Hat",  province: "AB", lat: 50.0405,  lng: -110.6764 },

  // Manitoba
  { name: "Winnipeg",      province: "MB", lat: 49.8951,  lng: -97.1384  },
  { name: "Brandon",       province: "MB", lat: 49.8485,  lng: -99.9501  },

  // Saskatchewan
  { name: "Saskatoon",     province: "SK", lat: 52.1332,  lng: -106.6700 },
  { name: "Regina",        province: "SK", lat: 50.4452,  lng: -104.6189 },

  // Nova Scotia
  { name: "Halifax",       province: "NS", lat: 44.6488,  lng: -63.5752  },
  { name: "Sydney",        province: "NS", lat: 46.1368,  lng: -60.1942  },

  // New Brunswick
  { name: "Moncton",       province: "NB", lat: 46.0878,  lng: -64.7782  },
  { name: "Saint John",    province: "NB", lat: 45.2733,  lng: -66.0633  },
  { name: "Fredericton",   province: "NB", lat: 45.9636,  lng: -66.6431  },

  // Newfoundland
  { name: "St. John's",    province: "NL", lat: 47.5615,  lng: -52.7126  },

  // Prince Edward Island
  { name: "Charlottetown", province: "PE", lat: 46.2382,  lng: -63.1311  },
]

export const PROVINCE_NAMES: Record<string, string> = {
  ON: "Ontario",
  QC: "Quebec",
  BC: "British Columbia",
  AB: "Alberta",
  MB: "Manitoba",
  SK: "Saskatchewan",
  NS: "Nova Scotia",
  NB: "New Brunswick",
  NL: "Newfoundland & Labrador",
  PE: "Prince Edward Island",
  YT: "Yukon",
  NT: "Northwest Territories",
  NU: "Nunavut",
}

export const CITIES_BY_PROVINCE = CANADIAN_CITIES.reduce(
  (acc, city) => {
    if (!acc[city.province]) acc[city.province] = [];
    acc[city.province]!.push(city);
    return acc;
  },
  {} as Record<string, CanadianCity[]>
)

export function getCityByName(name: string): CanadianCity | undefined {
  return CANADIAN_CITIES.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
}
