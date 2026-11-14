/**
 * Central configuration for Deepika Salon ERP.
 * Sirf yahin URL / key badalni hai - baaki code mein kahin nahi.
 */

// Naya Google Apps Script "Web app" deployment URL (Deploy > Manage deployments > Web app URL)
export const GOOGLE_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbyJ57ZnWDWsqxxaMWsbX_aFd7oZxHhas-M8uBmlnBAqPB2vMmU4v1QkJbyRNQ8zTy5oBQ/exec';

// Ye key apps-script/Code.gs ke UPLOAD_KEY se EXACT match honi chahiye.
// Iske bina koi bhi random banda aapke Drive mein file upload nahi kar sakta.
// Apni marzi se badal sakte ho (dono jagah same rakhna).
export const DRIVE_UPLOAD_KEY = 'DEEPIKA-STUDIO-2026';

// Photo upload se pehle image ko chhota (compress) karte hain, taki fast upload ho.
export const MAX_IMAGE_SIDE_PX = 1600;
export const IMAGE_QUALITY = 0.85;
