#  UP - Field Management System (UP-FMS)

**โปรเจครายวิชา Fundamental of Database System และ Software Process โดยกลุ่ม *No Name !***  
สาขาวิศวกรรมซอฟต์แวร์ มหาวิทยาลัยพะเยา ปีการศึกษา 2568**

**Project for Fundamental of Database System and Software Process courses by Group *No Name !***  
Software Engineering Department, University of Phayao, Academic Year 2025**

---

##  Project Details | รายละเอียดโครงการ
ระบบจัดเก็บและวิเคราะห์ข้อมูลการใช้บริการสนามกีฬา โดยใช้ **QR Code** สำหรับบันทึกผู้ใช้งานและการยืม–คืนอุปกรณ์ พร้อมนำเสนอข้อมูลในรูปแบบสถิติ กราฟ และ **Dashboard** เพื่อช่วยให้การบริหารจัดการสะดวกและมีประสิทธิภาพมากขึ้น  

*A system for recording and analyzing sports facility usage, utilizing **QR Code** scanning to track users and equipment check-in/out, while presenting data in statistical charts, graphs, and dashboards for efficient facility management.*

---

##  Team Members | ผู้จัดทำ  

| Student ID | Name (English) | ชื่อ (ไทย) |
|------------|----------------|------------|
| 67022951 | Ms. Achiraya Khieokanya | นางสาวอชิรญา เขียวกันยะ |
| 67022940 | Ms. Hataichanok Tansakun | นางสาวหทัยชนก ตันสกุล |
| 67023020 | Ms. Amornporn Onkhoksung | นางสาวอมราพร อ่อนโคกสูง |
| 67023086 | Mr. Aman Alikae | นายอามาน อาลีแก |

---

##  Background and Significance | ที่มาและความสำคัญ
ปัจจุบัน สนามกีฬาของมหาวิทยาลัยมีผู้ใช้บริการจำนวนมาก แต่การบันทึกข้อมูลยังคงใช้วิธีจดบันทึกด้วยมือหรือ Excel ซึ่งมีความเสี่ยงต่อความผิดพลาด ข้อมูลซ้ำซ้อน และยากต่อการวิเคราะห์เชิงลึก ดังนั้นจึงพัฒนาระบบ **UP-FMS** เพื่อแก้ปัญหาเหล่านี้  

*Currently, university sports facilities are widely used by students and staff. However, the data collection process still relies on manual recording or Excel, which can cause errors, duplication, and difficulties in analysis. Thus, the UP-FMS system is proposed to solve these challenges.*

---

##  Objectives | วัตถุประสงค์
- พัฒนาระบบดิจิทัลสำหรับบันทึกการใช้สนามกีฬาและการยืม–คืนอุปกรณ์  
- ให้เจ้าหน้าที่สามารถดูข้อมูลเชิงสถิติและ **Dashboard** ได้  
- ลดภาระงานการเก็บและสรุปรายงาน  
- เพิ่มความแม่นยำและสะดวกสบายด้วยการสแกน **QR Code**  
- รองรับการใช้งานทั้ง **คอมพิวเตอร์และโทรศัพท์มือถือ**  

*Objectives:*  
- Develop a digital system for recording sports facility usage and equipment check-in/out  
- Provide dashboards and statistical insights for staff  
- Reduce workload in data collection and reporting  
- Enhance accuracy and convenience with **QR Code** scanning  
- Ensure accessibility on both **PC and mobile devices**

---

##  Target Users | กลุ่มผู้ใช้งานหลัก
- เจ้าหน้าที่สนามกีฬา (Sports Facility Staff)  
- นิสิตช่วยงาน (Student Assistants)  
- นิสิตและบุคลากรทั่วไป (General Users)  

*Target Users:*  
- **Sports Facility Staff**: Manage facilities and equipment  
- **Student Assistants**: Assist staff in data collection  
- **General Users**: Students and staff who use sports facilities  

---

##  Key Features | ฟีเจอร์หลักของระบบ
- ระบบสแกน **QR Code** สำหรับผู้ใช้สนามและการยืม–คืนอุปกรณ์  
- ฟอร์มบันทึกข้อมูลรหัสนิสิต/บุคลากร และรายการอุปกรณ์ที่ยืม–คืน  
- ระบบสถิติและกราฟการใช้งาน (รายวัน / รายเดือน / รายปี)  
- **Dashboard** สำหรับสรุปข้อมูลการใช้งาน  
- ระบบค้นหาประวัติย้อนหลัง  
- ส่งออกข้อมูลเป็น **PDF** หรือ **Excel**  
- การแยกสิทธิ์ผู้ใช้งาน (เจ้าหน้าที่ / นิสิตช่วยงาน)  

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

*Key Features:*  
- **QR Code scanning** for facility entry and equipment check-in/out  
- Forms for recording student/staff ID and borrowed/returned items  
- Statistical visualization (daily, monthly, yearly)  
- **Dashboard** for usage summary  
- Searchable historical records  
- Export reports in **PDF** or **Excel** format  
- Role-based access control (Staff / Student Assistant)  

---

##  Suggested Technologies | เทคโนโลยีที่อาจใช้
- **Frontend**: HTML / CSS / JavaScript  
- **Backend**: Node.js / Python / Java / PHP
- **Database**: MySQL  
- **Authentication**: QR Code + Role-based Access  
- **Visualization**: Chart.js / D3.js  

---

##  Expected Benefits | ประโยชน์ที่คาดว่าจะได้รับ
- ระบบจัดเก็บและวิเคราะห์ข้อมูลที่ทันสมัยและแม่นยำ  
- ผู้บริหารสามารถใช้ข้อมูลเพื่อการวางแผนอย่างมีประสิทธิภาพ  
- ลดภาระงานเอกสารของเจ้าหน้าที่  
- ผู้ใช้งานเข้าถึงระบบได้ง่าย ทั้งคอมพิวเตอร์และมือถือ  

*Expected Benefits:*  
- Modern and accurate data collection and analysis  
- Useful insights for effective facility management  
- Reduced paperwork and workload for staff  
- User-friendly system accessible on both PC and mobile devices  

---
