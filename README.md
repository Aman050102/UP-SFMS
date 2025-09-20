# UP-Sports (UP-SFMS)
**University of Phayao - Sports Facility Management System**
=======
**โปรเจครายวิชา Fundamental of Database System และ Software Process โดยกลุ่ม *No Name !***  
สาขาวิศวกรรมซอฟต์แวร์ มหาวิท-ยาลัยพะเยา ปีการศึกษา 2568**


โปรเจครายวิชา _Fundamental of Database System_ และ _Software Process_  
โดยกลุ่ม **No Name !**  
สาขาวิศวกรรมซอฟต์แวร์ มหาวิทยาลัยพะเยา ปีการศึกษา 2568

---

## Project Overview

ระบบจัดการและวิเคราะห์ข้อมูลการใช้บริการสนามกีฬาและอุปกรณ์ โดยใช้ **QR Code** สำหรับเช็คอิน–เช็คเอาต์ผู้ใช้งาน  
มีเมนูแยก **Staff / User** และหน้า **Report** แสดงผลข้อมูลแบบ **สถิติ กราฟ และ Dashboard**

_A Django-based system for sports facility management, providing QR-based check-in/out,  
equipment usage tracking, role-based menus, and reporting dashboards._

---

## Team Members

| Student ID | Name (EN)                | Name (TH)               |
| ---------- | ------------------------ | ----------------------- |
| 67022951   | Ms. Achiraya Khieokanya  | นางสาวอชิรญา เขียวกันยะ |
| 67022940   | Ms. Hataichanok Tansakun | นางสาวหทัยชนก ตันสกุล   |
| 67023020   | Ms. Amornporn Onkhoksung | นางสาวอมราพร อ่อนโคกสูง |
| 67023086   | Mr. Aman Alikae          | นายอามาน อาลีแก         |

---

## Features

- ระบบ **Login / Logout** + Mock Login (role: staff / user)
- ระบบเช็คอิน–เช็คเอาต์ผ่าน **QR Code**
- บันทึก Log การใช้งานในฐานข้อมูล (`CheckinEvent`)
- ระบบ Pool Lock (ต้องเช็คเอาต์จากสระก่อนใช้งานสนามอื่น)
- หน้าเมนู **Staff Console** / **User Menu**
- หน้า **Report + API** แสดงข้อมูลสถิติและกราฟ
- รองรับ **Desktop / Mobile**
- ฟีเจอร์ถัดไป: **Borrow/Return, Booking, Export PDF/Excel, SSO**

---

## Tech Stack

- **Backend:** Django (Python)
- **Frontend:** HTML, CSS, JavaScript
- **Database:** SQLite (Dev) → MySQL/MariaDB (Deploy)
- **Visualization:** Chart.js
- **Authentication:** Django Auth + Mock Login

---

# UP-Sports (UP-SFMS)

ระบบจัดการสนามกีฬา + เช็คอิน/เช็คเอาต์ผ่าน QR/สแกน (Django)  
**แยก Staff / User** + หน้า Report และเชื่อม Supabase สำหรับ Scan Check-in/Out API

---

## สิ่งที่ต้องมี
- Python 3.10+ (Windows แนะนำติดตั้งจาก python.org แล้วติ๊ก "Add Python to PATH")
- Git / หรือ GitHub Desktop
- (ถ้าทำฟีเจอร์สแกน) Supabase project + API keys

---

## Quick Start (Windows)

> แนะนำใช้ GitHub Desktop ก็ได้ หรือจะใช้ Git CLI ก็ได้ เลือกอย่างใดอย่างหนึ่ง

### A) ใช้ GitHub Desktop
1) **Clone** repo นี้ลงเครื่อง
2) เปิดโฟลเดอร์โปรเจกต์ (เห็นไฟล์ `manage.py`, โฟลเดอร์ `core/`, `templates/`)

### B) ใช้ Git CLI
```powershell
git clone https://github.com/Aman050102/UP-Sports.git
cd UP-Sports

## Project Structure

