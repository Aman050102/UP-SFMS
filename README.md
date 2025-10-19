# UP - Sports Facility Management System (UP-SFMS)
**ระบบจัดการสนามกีฬา มหาวิทยาลัยพะเยา**

**โปรเจครายวิชา:** Fundamental of Database System และ Software Process  
**จัดทำโดยกลุ่ม:** *No Name !*  
**สาขา:** วิศวกรรมซอฟต์แวร์ มหาวิทยาลัยพะเยา  
**ปีการศึกษา:** 2568 (2025 Academic Year)

---

## Project Overview | ภาพรวมโครงการ
ระบบจัดการสนามกีฬา (UP-SFMS) ถูกพัฒนาขึ้นเพื่อให้การบันทึกข้อมูลการเข้าใช้สนามกีฬาและการยืม–คืนอุปกรณ์มีความเป็นดิจิทัล โปร่งใส และวิเคราะห์ได้จริง  
**นิสิตช่วยงาน** จะทำหน้าที่กรอกจำนวนผู้ใช้งานในแต่ละสนาม และจัดการการยืม–คืนอุปกรณ์กีฬา  
ขณะที่ **ผู้ดูแลระบบ (Admin)** สามารถดูสถิติ สร้างกราฟ ออกรายงาน และจัดการอุปกรณ์ได้อย่างสะดวก

> The UP-SFMS system digitizes the management of university sports facilities.  
> **Student Assistants** record field usage and handle borrow/return tasks,  
> while **Admins** view analytics, generate charts and PDF reports, and manage equipment seamlessly.

---

## Team Members | ผู้จัดทำ
| Student ID | Name (English) | ชื่อ (ไทย) |
|:-----------:|:---------------|:-------------|
| 67022951 | Ms. Achiraya Khieokanya | นางสาวอชิรญา เขียวกันยะ |
| 67022940 | Ms. Hataichanok Tansakun | นางสาวหทัยชนก ตันสกุล |
| 67023020 | Ms. Amornporn Onkhoksung | นางสาวอมราพร อ่อนโคกสูง |
| 67023086 | Mr. Aman Alikae | นายอามาน อาลีแก |

---

##  Background & Significance | ที่มาและความสำคัญ
กองกิจการนิสิต มหาวิทยาลัยพะเยา ได้จัดเก็บข้อมูลการใช้สนามกีฬาโดยวิธีจดบันทึกหรือไฟล์ Excel ซึ่งอาจเกิดข้อผิดพลาด ซ้ำซ้อน และตรวจสอบย้อนหลังได้ยาก  
จึงเกิดแนวคิดพัฒนา **ระบบ UP-SFMS** เพื่อให้นิสิตช่วยงานสามารถกรอกข้อมูลการเข้าใช้สนาม และบันทึกการยืม–คืนอุปกรณ์ผ่านระบบเดียวกัน  
ระบบนี้ช่วยลดภาระงานเอกสาร เพิ่มความถูกต้อง ความรวดเร็ว และสามารถนำข้อมูลไปวิเคราะห์เชิงสถิติได้ในรูปแบบ **กราฟ และ แดชบอร์ด**

> Currently, facility usage data are manually logged or stored in Excel,  
> leading to errors and redundancy.  
> **UP-SFMS** provides a unified digital platform for assistants to record usage and borrow/return data,  
> ensuring accuracy, efficiency, and actionable analytics through graphs and dashboards.

---

##  Objectives | วัตถุประสงค์
- จัดเก็บข้อมูลผู้ใช้สนามกีฬาและการยืม–คืนอุปกรณ์ในระบบดิจิทัล  
- ลดภาระงานและข้อผิดพลาดจากเอกสาร  
- แสดงผลข้อมูลในรูปแบบ **กราฟ สถิติ แดชบอร์ด** รายวัน รายเดือน รายปี  
- รองรับการส่งออกข้อมูลเป็น **PDF / CSV**  
- ใช้งานได้ทั้ง **คอมพิวเตอร์และโทรศัพท์มือถือ**

> - Develop a digital platform for facility usage and equipment tracking  
> - Minimize manual workload and errors  
> - Provide visualized insights (daily, monthly, yearly)  
> - Enable PDF / CSV exports  
> - Ensure responsive design across devices

---

## Target Users | กลุ่มผู้ใช้งาน
| Role | Description | บทบาท |
|------|--------------|--------|
| **Student Assistants** | Record facility usage and handle borrow/return processes | บันทึกจำนวนผู้ใช้สนาม และยืม–คืนอุปกรณ์ |
| **Admins** | Analyze data, view dashboards, manage equipment | ตรวจสอบสถิติ กราฟ รายงาน และจัดการข้อมูล |

---

## System Functions | ฟังก์ชันหลักของระบบ

### 1. Facility Usage Recording (นิสิตช่วยงาน)
- บันทึกจำนวนผู้ใช้สนามกีฬา 4 ประเภท  
  - **สระว่ายน้ำ (Pool)**  
  - **ลู่–ลาน (Track)**  
  - **แบดมินตัน (Badminton)**  
  - **กลางแจ้ง (Outdoor)** ซึ่งมีสนามย่อย เช่น  
    เทนนิส, บาสเกตบอล, ฟุตซอล, ฟุตบอล, วอลเลย์บอล, เซปักตะกร้อ ฯลฯ  
- กรอกจำนวน นิสิต และ บุคลากร แต่ละสนาม  
- ข้อมูลถูกบันทึกในฐานข้อมูล ตรวจสอบย้อนหลังได้

### 2. Equipment Borrow/Return (นิสิตช่วยงาน)
- ยืม – คืนอุปกรณ์ โดยระบุรหัสนิสิต (ขึ้นต้น 6 และ 8 หลัก)  
- ระบบตรวจสอบสต็อก และอัปเดตจำนวนแบบอัตโนมัติ  
- แสดงรายการที่ค้างคืน และสรุปบันทึกรายวัน

### 3. Admin Analytics & Reports (แอดมิน)
- แสดงสถิติการใช้งานในรูปแบบ  
  - **กราฟเส้น (Line)**  
  - **กราฟแท่ง (Bar)**  
  - **กราฟวงกลม (Pie)**  
- เลือกดูได้ทั้ง รายวัน รายเดือน รายปี  
- แปลงข้อมูลเป็น **รายงาน PDF** และ **สถิติ CSV**  
- จัดการอุปกรณ์กีฬา (เพิ่ม / แก้ไข / ลบ / อัปเดตสต็อก)

---

##  Tech Stack | เทคโนโลยีที่ใช้
| Layer | Technologies |
|-------|---------------|
| **Frontend** | HTML, CSS, JavaScript |
| **Backend** | Django (Python) |
| **Database** | SQLite (Dev) → MySQL / MariaDB (Deploy) |
| **Visualization** | Chart.js |
| **Export** | pdfkit + wkhtmltopdf (for PDF reports) |
| **Auth** | Django Auth (+ Mock Login for demo) |

---

## Installation & Run Guide | วิธีติดตั้งและรันระบบ
```bash
# Create Virtual Environment
python -m venv .venv
source .venv/bin/activate     # macOS/Linux
# .venv\Scripts\Activate.ps1  # Windows PowerShell

# Install dependencies
pip install -r requirements.txt

#  Run Django
python manage.py migrate
python manage.py runserver