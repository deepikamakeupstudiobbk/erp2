# Deepika Salon ERP - Setup Guide (Hinglish)

## 1. Google Apps Script update karo (5 min, sirf ek baar)
1. Google Sheet **DeepikaUpdatedSheet** kholo (deepikamakeupstudiobbk@gmail.com se).
2. **Extensions → Apps Script** par click karo.
3. Purana saara code delete karo, aur is project ki `apps-script/Code.gs` file ka poora code paste karo. Save (Ctrl+S).
4. Upar function list se **setupOnce** select karo → **Run** dabao → Google permission maange to **Allow** karo
   (Advanced → Go to project (unsafe) → Allow). Isse Drive folder aur Sheet ke headers ban jaate hain.
5. **Deploy → Manage deployments → pencil (edit) icon → Version: New version → Deploy**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Naya deployment banana ho to URL badlega; tab `src/config.ts` mein URL update karna padega.
   (Aapka diya hua URL already `src/config.ts` mein daal diya hai.)

> Script **sheet ke andar se** (Extensions → Apps Script) khuli honi chahiye, tabhi use "Photos" aur "Bookings" tabs mil paate hain.

## 2. Secret key (zaroori)
`src/config.ts` mein `DRIVE_UPLOAD_KEY` aur `Code.gs` mein `UPLOAD_KEY` **bilkul same** hone chahiye
(default: `DEEPIKA-STUDIO-2026`). Apni pasand ki key dono jagah same rakh do.

## 3. GitHub par upload
Is folder ki saari files (node_modules ya dist chhodkar) repo mein upload karo. `.github/workflows/deploy.yml`
apne aap build karke GitHub Pages par live kar dega. (Settings → Pages → Source: **GitHub Actions** hona chahiye.)

## 4. ERP mein photo upload kaise karein
1. Website par **ERP** → Owner login (default: username `admin`, password `admin`).
2. **Clients & Photo Vault** tab → client chuno.
3. **Choose File** se photo chuno → title likho → **Upload to Drive**.
4. Photo Drive folder **Deepika Salon Client Photos** mein jayegi aur Sheet ke **Photos** tab mein entry banegi.

## 5. Zaroori suggestions
- ERP login ka default password `admin` hai - login karte hi **Settings / Credentials** se badal do.
- Drive ki photos "link wale sab dekh sakte hain" par set hoti hain taaki website par dikh sakein. Link kisi ko mat bhejo.
- Bookings aur Photos Sheet mein save hoti hain. Leads, expenses, staff, attendance abhi sirf us browser/device mein save hote hain (Backup JSON se download kar sakte ho).


## 6. Bookings, Staff aur Daily Customers
- **Bookings** tab: Owner aur Staff dono entry add / update kar sakte hain. **Delete sirf Owner** kar sakta hai.
- **Package** ka naam khud likhna hota hai. Booking ID us naam ke **pehle akshar** se banti hai (Bridal -> B-001, Party -> P-001).
- Dates mein **Aaj** button hai. Advance date naye form mein aaj ki aati hai, aur paid amount likhte hi khali date aaj ki ho jati hai.
- **Staff Logins** tab (sirf Owner): naya staff add karo (Naam + Login ID + Password), **Change Password** ya **Remove** kar sakte ho.
- Staff apni Login ID + password se ERP mein login karta hai (Staff Employee tab) aur use **sirf Bookings dashboard** dikhta hai. Uski sab entries Owner ko Bookings mein dikhti hain.
- Staff ke password Sheet ke **Staff** tab mein hash ke roop mein rehte hain, kisi ko dikhte nahi. Sirf badal sakte ho.
- **Daily Customers** tab sirf Owner ke liye hai.
- Sab entries Google Sheet ke **Bookings**, **DailyCustomers** aur **Staff** tabs mein apne aap aati hain (naya Code.gs deploy hona zaroori hai).

---

## NAYA ERP (v2) – Google Sheet script dobara deploy karna ZAROORI hai

Naye ERP mein **Employees** aur **Expenses** ke naye tabs, Backup aur Staff login hai. Ye sab `apps-script/Code.gs` mein hai, isliye:

1. Google Sheet kholo → **Extensions → Apps Script**.
2. Purana code hata kar naya `apps-script/Code.gs` poora paste karo → Save.
3. Upar function list se **`setupOnce`** chuno → **Run** (permission maangega → Allow). Isse `Employees` aur `Expenses` tab ban jate hain.
4. **Deploy → Manage deployments → ✏️ (edit) → Version: "New version" → Deploy.**
   (Ye step bhoolne par naya Employee / Expense / Backup kaam nahi karega aur ERP mein laal error dikhega.)
5. URL wahi rahta hai (`src/config.ts` mein badalna nahi hai).

**Sheet ke tabs:** `Bookings`, `DailyCustomers` (naya "Staff" column apne aap judta hai, purana data safe), `Expenses`, `Employees`, `Photos`.

**Employee login:** ERP → Employee → Add Employee mein naam, mobile, login ID, password bharo. Wahi ID + password se staff "Staff Employee" tab se login karega. Password Sheet mein hash ke roop mein rehta hai (dikhta nahi), bhoolne par "Password badlo".
