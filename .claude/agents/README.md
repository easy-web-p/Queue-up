# Multi-Agent Config สำหรับ QueueUp for Campus

ชุด config นี้เขียนในรูปแบบ **Claude Code Sub-agents** (`.claude/agents/*.md`) พร้อม YAML frontmatter (`name`, `description`, `tools`, `model`)

## วิธีติดตั้ง
1. คัดลอกไฟล์ทั้งหมด (`00-orchestrator.md` ถึง `06-auditor.md`) ไปไว้ที่ `.claude/agents/` ในโปรเจกต์ QueueUp (`D:/my-QueueUp-app/.claude/agents/`)
2. สร้างโฟลเดอร์ `docs/` ในโปรเจกต์ (ถ้ายังไม่มี) สำหรับ shared state:
   - `docs/architecture_doc.md`
   - `docs/design_system.md`
   - `docs/review_log.md`
   - `docs/audit_log.md`
   - `docs/roadmap.md`
   - `docs/iteration_score_history.md`
3. เรียกใช้งานผ่าน orchestrator ก่อนเสมอ เช่น:
   > "ใช้ orchestrator agent เริ่ม cycle ใหม่สำหรับ StudentVendorOnboarding"

## ลำดับ Agent (ไฟล์เรียงตามลำดับการทำงานปกติ)
| ไฟล์ | Agent | บทบาทสั้นๆ |
|---|---|---|
| `00-orchestrator.md` | orchestrator | คุม flow, เช็ค stopping criteria |
| `01-strategist.md` | strategist | คิดฟีเจอร์/roadmap |
| `02-planner.md` | planner | ออกแบบ architecture/schema/security rules |
| `03-designer.md` | designer | UX/UI (โหมด new/extend) |
| `04-builder.md` | builder | เขียนโค้ดจริง |
| `05-reviewer.md` | reviewer | ตรวจโค้ดระดับ PR |
| `06-auditor.md` | auditor | ตรวจโครงสร้างทั้งระบบเป็นระยะ |

## หมายเหตุสำคัญ
- `model: opus` ใช้กับ agent ที่ต้องคิดเชิงลึก/ตัดสินใจสำคัญ (orchestrator, strategist, planner, reviewer, auditor)
- `model: sonnet` ใช้กับ agent ที่ทำงานตาม spec ชัดเจนอยู่แล้ว (designer, builder) เพื่อความเร็ว/ต้นทุน — ปรับเป็น opus ได้ถ้าต้องการคุณภาพสูงสุดทุกจุด
- ถ้าจะย้ายไป platform อื่น (CrewAI, AutoGen, LangGraph) โครงสร้าง prompt เนื้อหาในแต่ละไฟล์ใช้ได้เหมือนเดิม แค่ต้องแปลง YAML frontmatter เป็น syntax ของ framework นั้นๆ (เช่น CrewAI ใช้ `role`, `goal`, `backstory`, `tools` แยก object)
