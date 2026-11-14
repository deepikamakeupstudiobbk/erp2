/**
 * Deepika Salon ERP - Google Apps Script backend
 * ------------------------------------------------
 * Ye script 3 kaam karti hai:
 *   1. Client photos ko Drive folder "Deepika Salon Client Photos" mein save karna
 *   2. Photos ki list Sheet ke "Photos" tab mein rakhna
 *   3. Bookings (tab "Bookings") aur Daily Customers (tab "DailyCustomers") ki entries save / update / delete karna
 *
 * SETUP: SETUP_GUIDE_HINGLISH.md dekho. Is file ko Apps Script editor mein paste karo
 * (jo script "DeepikaUpdatedSheet" se Extensions > Apps Script se khuli ho).
 */

// ===== SETTINGS (sirf yahin badalna hai) =====
var UPLOAD_KEY = 'DEEPIKA-STUDIO-2026';          // src/config.ts ke DRIVE_UPLOAD_KEY jaisa hi hona chahiye
var DRIVE_FOLDER_NAME = 'Deepika Salon Client Photos';
var PHOTOS_SHEET = 'Photos';
var BOOKINGS_SHEET = 'Bookings';

var DAILY_SHEET = 'DailyCustomers';
var STAFF_SHEET = 'Staff';
var STAFF_SALT = 'deepika-salon-2026';   // password hash ke liye (badalna ho to badal sakte ho, par phir sab staff ke password dobara set karne honge)
var STAFF_HEADERS = ['Login ID', 'Name', 'Password Hash', 'Active', 'Created At'];

var PHOTO_HEADERS = ['PhotoID', 'ClientID', 'ClientName', 'Title', 'Category', 'Date', 'DriveFileID', 'URL', 'UploadedAt'];

// Har entry ke fields (website ke LedgerEntry se same naam). Order = Sheet ke columns ka order.
var BOOKING_KEYS = ['id','clientName','mobile','eventDate','packageName','totalAmount','advanceDate','advanceAmount',
  's1Date','s1Desc','s1Paid','s2Date','s2Desc','s2Paid','s3Date','s3Desc','s3Paid','pending','status','createdAt','updatedAt','createdBy','staff'];
var BOOKING_HEADERS = ['ID','Client Name','Mobile','Event Date','Package','Total Amount','Advance Date','Advance Amount',
  'S1 Date','S1 Description','S1 Paid','S2 Date','S2 Description','S2 Paid','S3 Date','S3 Description','S3 Paid','Pending','Status','Created At','Updated At','Created By','Staff'];

var DAILY_KEYS = ['id','clientName','mobile','eventDate','packageName','totalAmount','advanceDate','advanceAmount',
  's1Date','s1Desc','s1Paid','s2Date','s2Desc','s2Paid','pending','status','createdAt','updatedAt','createdBy','staff'];
var DAILY_HEADERS = ['ID','Client Name','Mobile','Event Date','Package','Total Amount','Advance Date','Advance Amount',
  'S1 Date','S1 Description','S1 Paid','S2 Date','S2 Description','S2 Paid','Pending','Status','Created At','Updated At','Created By','Staff'];

// Ye fields number hain (baaki sab text)
var NUMBER_KEYS = ['totalAmount','advanceAmount','s1Paid','s2Paid','s3Paid','pending'];

// ===== ENTRY POINTS =====
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.key !== UPLOAD_KEY) return json_({ status: 'error', message: 'Unauthorized' });
    if (p.action === 'getPhotos') return json_({ status: 'success', photos: getPhotos_() });
    if (p.action === 'listStaff') return json_({ status: 'success', staff: listStaff_() });
    if (p.action === 'listEmployees') return json_({ status: 'success', employees: listEmployees_() });
    if (p.action === 'getExpenses') return json_({ status: 'success', expenses: tableRead_(TABLES.expense) });
    if (p.action === 'getLedger') return json_({ status: 'success', bookings: readEntries_('booking'), daily: readEntries_('daily') });
    return json_({ status: 'success', message: 'Deepika Salon ERP script is running' });
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var data = JSON.parse(e.postData.contents);
    if (data.key !== UPLOAD_KEY) return json_({ status: 'error', message: 'Unauthorized: key galat hai' });

    switch (data.action) {
      case 'uploadPhoto':   return json_(uploadPhoto_(data));
      case 'deletePhoto':   return json_(deletePhoto_(data));
      case 'staffLogin':        return json_(staffLogin_(data));
      case 'addStaff':          return json_(addStaff_(data));
      case 'setStaffPassword':  return json_(setStaffPassword_(data));
      case 'removeStaff':       return json_(removeStaff_(data));
      case 'saveEmployee':      return json_(saveEmployee_(data));
      case 'deleteEmployee':    return json_(deleteEmployee_(data));
      case 'saveExpense':       return json_(tableSaveAction_(TABLES.expense, data.entry, 'X'));
      case 'deleteExpense':     return json_(tableDelete_(TABLES.expense, data.id));
      case 'getBackup':         return json_({ status: 'success', backup: buildBackup_() });
      case 'driveBackup':       return json_(driveBackup_());
      case 'restoreBackup':     return json_(restoreBackup_(data));
      case 'resetAll':          return json_(resetAll_());
      case 'saveEntry':     return json_(saveEntry_(data));
      case 'deleteEntry':   return json_(deleteEntry_(data));
      default:              return json_({ status: 'error', message: 'Unknown action: ' + data.action });
    }
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// ===== PHOTOS =====
function uploadPhoto_(d) {
  if (!d.base64Content) return { status: 'error', message: 'Photo data nahi mila' };

  var base64 = String(d.base64Content).replace(/^data:[^;]+;base64,/, '');
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), d.mimeType || 'image/jpeg', d.fileName || ('photo_' + Date.now() + '.jpg'));

  var file = getFolder_().createFile(blob);
  // Website par dikhane ke liye "link wale sab dekh sakte hain" zaroori hai
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fileId = file.getId();
  var url = 'https://lh3.googleusercontent.com/d/' + fileId + '=w1200';

  getSheet_(PHOTOS_SHEET, PHOTO_HEADERS).appendRow([
    d.photoId || ('cp-' + Date.now()),
    d.clientId || '',
    d.clientName || '',
    d.title || '',
    d.category || '',
    d.date || '',
    fileId,
    url,
    new Date()
  ]);

  return { status: 'success', fileId: fileId, url: url };
}

function deletePhoto_(d) {
  var sheet = getSheet_(PHOTOS_SHEET, PHOTO_HEADERS);
  var rows = sheet.getDataRange().getValues();
  var fileId = d.fileId || '';
  for (var i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === d.photoId) {
      fileId = fileId || rows[i][6];
      sheet.deleteRow(i + 1);
    }
  }
  if (fileId) {
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (x) {}
  }
  return { status: 'success' };
}

function getPhotos_() {
  var rows = getSheet_(PHOTOS_SHEET, PHOTO_HEADERS).getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push({
      photoId: rows[i][0], clientId: rows[i][1], clientName: rows[i][2], title: rows[i][3],
      category: rows[i][4], date: String(rows[i][5]), fileId: rows[i][6], url: rows[i][7]
    });
  }
  return out;
}

// ===== BOOKINGS & DAILY CUSTOMERS =====
function cfg_(kind) {
  return kind === 'daily'
    ? { sheet: DAILY_SHEET, keys: DAILY_KEYS, headers: DAILY_HEADERS }
    : { sheet: BOOKINGS_SHEET, keys: BOOKING_KEYS, headers: BOOKING_HEADERS };
}

// Sheet ka pura data entries ki list mein badalta hai
function readEntries_(kind) {
  var c = cfg_(kind);
  var rows = getLedgerSheet_(c).getDataRange().getValues();
  var tz = Session.getScriptTimeZone();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    var e = {};
    for (var k = 0; k < c.keys.length; k++) {
      var key = c.keys[k];
      var v = rows[i][k];
      if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      e[key] = NUMBER_KEYS.indexOf(key) > -1 ? (Number(v) || 0) : (v === null || v === undefined ? '' : String(v));
    }
    out.push(e);
  }
  return out;
}

function saveEntry_(d) {
  var c = cfg_(d.kind);
  var sheet = getLedgerSheet_(c);
  var entry = d.entry || {};
  if (!entry.id) return { status: 'error', message: 'ID missing' };

  var last = sheet.getLastRow();
  var ids = last > 1 ? sheet.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];

  // Naya entry hai aur ID pehle se ban chuki hai (kisi aur device ne le li) -> agla free ID do
  if (d.isNew && ids.indexOf(entry.id) > -1) entry.id = nextId_(entry.id, ids);

  var row = c.keys.map(function (key) {
    var v = entry[key];
    if (NUMBER_KEYS.indexOf(key) > -1) return Number(v) || 0;
    return v === null || v === undefined ? '' : String(v);
  });

  var idx = ids.indexOf(entry.id);
  if (idx > -1) sheet.getRange(idx + 2, 1, 1, row.length).setValues([row]);   // update
  else sheet.appendRow(row);                                                   // naya
  return { status: 'success', id: entry.id };
}

function deleteEntry_(d) {
  var c = cfg_(d.kind);
  var sheet = getLedgerSheet_(c);
  var last = sheet.getLastRow();
  if (last < 2) return { status: 'success' };
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === String(d.id)) sheet.deleteRow(i + 2);
  }
  return { status: 'success' };
}

function nextId_(id, ids) {
  var prefix = id.replace(/-\d+$/, '');
  var max = 0;
  ids.forEach(function (x) {
    if (x.indexOf(prefix + '-') === 0) {
      var n = parseInt(x.slice(prefix.length + 1), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  var next = String(max + 1);
  while (next.length < 3) next = '0' + next;
  return prefix + '-' + next;
}

// Sheet nikalo; agar purane format ke headers hain to purani sheet ko "_old_" naam se bacha lo aur nayi banao
function getLedgerSheet_(c) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(c.sheet);
  if (sheet && sheet.getLastRow() > 0) {
    var current = sheet.getRange(1, 1, 1, c.headers.length).getValues()[0];
    var n = 0; while (n < current.length && current[n] !== '') n++;
    if (n > 0 && n < c.headers.length && current.slice(0, n).join('|') === c.headers.slice(0, n).join('|')) {
      // Sirf nayi column(s) jodni hain (jaise \"Staff\") - purana data waisa hi rahega
      sheet.getRange(1, n + 1, 1, c.headers.length - n).setValues([c.headers.slice(n)]).setFontWeight('bold').setBackground('#fde68a');
      current = c.headers.slice();
    }
    if (current.join('|') !== c.headers.join('|')) {
      sheet.setName(c.sheet + '_old_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss'));
      sheet = null;
    }
  }
  if (!sheet) sheet = ss.getSheetByName(c.sheet) || ss.insertSheet(c.sheet);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(c.headers);
    sheet.getRange(1, 1, 1, c.headers.length).setFontWeight('bold').setBackground('#fde68a');
    sheet.setFrozenRows(1);
    // Mobile / dates / text ko text format do (leading zero na jaye), amounts ko number
    sheet.getRange(1, 1, sheet.getMaxRows(), c.headers.length).setNumberFormat('@');
    c.keys.forEach(function (key, i) {
      if (NUMBER_KEYS.indexOf(key) > -1) sheet.getRange(2, i + 1, sheet.getMaxRows() - 1, 1).setNumberFormat('0');
    });
  }
  return sheet;
}

// ===== STAFF LOGINS =====
// Password sheet mein plain text nahi, hash ke roop mein rakha jata hai (kisi ko dikh nahi sakta).
function hashPass_(loginId, pass) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, loginId + ':' + pass + ':' + STAFF_SALT);
  return raw.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function staffRows_() {
  var sheet = getSheet_(STAFF_SHEET, STAFF_HEADERS);
  return { sheet: sheet, rows: sheet.getDataRange().getValues() };
}

function findStaffRow_(rows, loginId) {
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === loginId) return i;
  }
  return -1;
}

function normId_(v) { return String(v || '').trim().toLowerCase(); }

function listStaff_() {
  var r = staffRows_(), out = [];
  for (var i = 1; i < r.rows.length; i++) {
    if (!r.rows[i][0] || r.rows[i][3] !== 'yes') continue;
    out.push({ loginId: String(r.rows[i][0]), name: String(r.rows[i][1]), createdAt: String(r.rows[i][4]) });
  }
  return out;
}

function staffLogin_(d) {
  var id = normId_(d.loginId);
  var emps = tableRead_(TABLES.employee, true);
  for (var k = 0; k < emps.length; k++) {
    if (normId_(emps[k].loginId) === id && emps[k].active !== 'no' && emps[k].passHash === hashPass_(id, String(d.password || ''))) {
      return { status: 'success', loginId: id, name: String(emps[k].name) };
    }
  }
  var r = staffRows_(), i = findStaffRow_(r.rows, id);
  if (i < 0 || r.rows[i][3] !== 'yes' || String(r.rows[i][2]) !== hashPass_(id, String(d.password || ''))) {
    return { status: 'error', message: 'Login ID ya password galat hai' };
  }
  return { status: 'success', loginId: id, name: String(r.rows[i][1]) };
}

function addStaff_(d) {
  var id = normId_(d.loginId), name = String(d.name || '').trim(), pass = String(d.password || '');
  if (!id || !name) return { status: 'error', message: 'Naam aur Login ID zaroori hain' };
  if (pass.length < 4) return { status: 'error', message: 'Password kam se kam 4 akshar ka rakhein' };
  var r = staffRows_();
  if (findStaffRow_(r.rows, id) > -1) return { status: 'error', message: 'Ye Login ID pehle se hai' };
  r.sheet.getRange(r.sheet.getLastRow() + 1, 1, 1, 5).setNumberFormat('@');   // text format: phone jaisa ID / hash kharab na ho
  r.sheet.appendRow([id, name, hashPass_(id, pass), 'yes', Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')]);
  return { status: 'success' };
}

function setStaffPassword_(d) {
  var id = normId_(d.loginId), pass = String(d.password || '');
  if (pass.length < 4) return { status: 'error', message: 'Password kam se kam 4 akshar ka rakhein' };
  var r = staffRows_(), i = findStaffRow_(r.rows, id);
  if (i < 0) return { status: 'error', message: 'Staff nahi mila' };
  r.sheet.getRange(i + 1, 3).setNumberFormat('@').setValue(hashPass_(id, pass));
  return { status: 'success' };
}

function removeStaff_(d) {
  var id = normId_(d.loginId), r = staffRows_(), i = findStaffRow_(r.rows, id);
  if (i > -1) r.sheet.deleteRow(i + 1);
  return { status: 'success' };
}


// ===== EMPLOYEES & EXPENSES (generic tables) =====
var TABLES = {
  expense: {
    sheet: 'Expenses',
    keys: ['id','type','date','month','name','amount','mode','vendor','qty','notes','createdAt','createdBy'],
    headers: ['ID','Type','Date','Month','Staff / Item','Amount','Mode','Supplier','Qty','Notes','Created At','Created By'],
    nums: ['amount']
  },
  employee: {
    sheet: 'Employees',
    keys: ['id','name','mobile','loginId','passHash','designation','salary','joinDate','address','photoUrl','photoFileId','active','createdAt'],
    headers: ['ID','Name','Mobile','Login ID','Password Hash','Designation','Monthly Salary','Joining Date','Address','Photo URL','Photo File ID','Active','Created At'],
    nums: ['salary']
  }
};

function tableSheet_(t) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(t.sheet) || ss.insertSheet(t.sheet);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(t.headers);
    sheet.getRange(1, 1, 1, t.headers.length).setFontWeight('bold').setBackground('#fde68a');
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, sheet.getMaxRows(), t.headers.length).setNumberFormat('@');
    t.keys.forEach(function (key, i) {
      if (t.nums.indexOf(key) > -1) sheet.getRange(2, i + 1, sheet.getMaxRows() - 1, 1).setNumberFormat('0');
    });
  }
  return sheet;
}

function tableRead_(t, withSecret) {
  var rows = tableSheet_(t).getDataRange().getValues();
  var tz = Session.getScriptTimeZone(), out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    var e = {};
    for (var k = 0; k < t.keys.length; k++) {
      var key = t.keys[k], v = rows[i][k];
      if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      e[key] = t.nums.indexOf(key) > -1 ? (Number(v) || 0) : (v === null || v === undefined ? '' : String(v));
    }
    if (!withSecret) delete e.passHash;
    out.push(e);
  }
  return out;
}

function tableIds_(sheet) {
  var last = sheet.getLastRow();
  return last > 1 ? sheet.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
}

// entry ko upsert karta hai (id se). Naya ho aur ID mil chuki ho to agla free ID deta hai.
function tableUpsert_(t, entry, idPrefix, isNew) {
  var sheet = tableSheet_(t), ids = tableIds_(sheet);
  if (!entry.id || (isNew && ids.indexOf(entry.id) > -1)) entry.id = nextId_((entry.id || idPrefix + '-000'), ids);
  var row = t.keys.map(function (key) {
    var v = entry[key];
    if (t.nums.indexOf(key) > -1) return Number(v) || 0;
    return v === null || v === undefined ? '' : String(v);
  });
  var idx = ids.indexOf(entry.id);
  if (idx > -1) sheet.getRange(idx + 2, 1, 1, row.length).setValues([row]);
  else { sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]); }
  return entry.id;
}

function tableSaveAction_(t, entry, prefix) {
  return { status: 'success', id: tableUpsert_(t, entry || {}, prefix, false) };
}

function tableDelete_(t, id) {
  var sheet = tableSheet_(t), ids = tableIds_(sheet);
  for (var i = ids.length - 1; i >= 0; i--) if (ids[i] === String(id)) sheet.deleteRow(i + 2);
  return { status: 'success' };
}

// --- Employees ---
function listEmployees_() {
  return tableRead_(TABLES.employee, true).map(function (e) {
    var hasPass = !!e.passHash;
    delete e.passHash;
    e.hasPassword = hasPass;
    return e;
  });
}

function saveEmployee_(d) {
  var e = d.entry || {};
  var name = String(e.name || '').trim(), mobile = String(e.mobile || '').trim();
  var loginId = normId_(e.loginId), pass = String(d.password || '');
  if (!name || !mobile || !loginId) return { status: 'error', message: 'Naam, Mobile aur Login ID zaroori hain' };
  if (/\s/.test(loginId)) return { status: 'error', message: 'Login ID mein space nahi hona chahiye' };

  var all = tableRead_(TABLES.employee, true), old = null;
  for (var i = 0; i < all.length; i++) {
    if (e.id && all[i].id === e.id) old = all[i];
    else if (normId_(all[i].loginId) === loginId) return { status: 'error', message: 'Ye Login ID kisi aur employee ki hai' };
  }
  if (!old && pass.length < 4) return { status: 'error', message: 'Password kam se kam 4 akshar ka rakhein' };
  if (pass && pass.length < 4) return { status: 'error', message: 'Password kam se kam 4 akshar ka rakhein' };
  if (old && !pass && normId_(old.loginId) !== loginId) return { status: 'error', message: 'Login ID badli hai to naya password bhi daalein' };

  var rec = {
    id: old ? old.id : (e.id || ''),
    name: name, mobile: mobile, loginId: loginId,
    passHash: pass ? hashPass_(loginId, pass) : (old ? old.passHash : ''),
    designation: String(e.designation || ''), salary: Number(e.salary) || 0,
    joinDate: String(e.joinDate || ''), address: String(e.address || ''),
    photoUrl: String(e.photoUrl || ''), photoFileId: String(e.photoFileId || ''),
    active: e.active === 'no' ? 'no' : 'yes',
    createdAt: old ? old.createdAt : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')
  };
  var id = tableUpsert_(TABLES.employee, rec, 'E', !old);
  return { status: 'success', id: id };
}

function deleteEmployee_(d) {
  var all = tableRead_(TABLES.employee, true);
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === d.id && all[i].photoFileId) { try { DriveApp.getFileById(all[i].photoFileId).setTrashed(true); } catch (x) {} }
  }
  return tableDelete_(TABLES.employee, d.id);
}

// ===== BACKUP =====
function buildBackup_() {
  return {
    app: 'Deepika Studio ERP', version: 2,
    createdAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"),
    bookings: readEntries_('booking'),
    daily: readEntries_('daily'),
    expenses: tableRead_(TABLES.expense),
    employees: tableRead_(TABLES.employee, true)
  };
}

function driveBackup_() {
  var it = DriveApp.getFoldersByName('Deepika ERP Backups');
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder('Deepika ERP Backups');
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm');
  var file = folder.createFile('deepika_erp_backup_' + stamp + '.json', JSON.stringify(buildBackup_()), 'application/json');
  return { status: 'success', name: file.getName(), url: file.getUrl(), folderUrl: folder.getUrl() };
}

function restoreBackup_(d) {
  var b = d.backup || {}, n = 0;
  (b.bookings || []).forEach(function (x) { saveEntry_({ kind: 'booking', isNew: false, entry: x }); n++; });
  (b.daily || []).forEach(function (x) { saveEntry_({ kind: 'daily', isNew: false, entry: x }); n++; });
  (b.expenses || []).forEach(function (x) { tableUpsert_(TABLES.expense, x, 'X', false); n++; });
  (b.employees || []).forEach(function (x) { tableUpsert_(TABLES.employee, x, 'E', false); n++; });
  return { status: 'success', restored: n };
}

// Reset: pehle Drive mein automatic backup, phir Bookings / Customers / Expenses saaf (Employees safe rehte hain)
function resetAll_() {
  var bk = driveBackup_();
  [getLedgerSheet_(cfg_('booking')), getLedgerSheet_(cfg_('daily')), tableSheet_(TABLES.expense)].forEach(function (sh) {
    var last = sh.getLastRow();
    if (last > 1) sh.deleteRows(2, last - 1);
  });
  return { status: 'success', backupUrl: bk.url };
}

// ===== HELPERS =====
function getFolder_() {
  var it = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

// Script "DeepikaUpdatedSheet" se khuli honi chahiye (Extensions > Apps Script) - tab ye sheet apne aap milti hai.
function getSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#fde68a');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ===== EK BAAR CHALAO (Run) =====
// Isse Drive permission mil jati hai aur folder + sheet headers ban jate hain.
function setupOnce() {
  getFolder_();
  getSheet_(PHOTOS_SHEET, PHOTO_HEADERS);
  getLedgerSheet_(cfg_('booking'));
  getLedgerSheet_(cfg_('daily'));
  getSheet_(STAFF_SHEET, STAFF_HEADERS);
  tableSheet_(TABLES.expense);
  tableSheet_(TABLES.employee);
  Logger.log('Setup complete. Folder: ' + getFolder_().getUrl());
}
