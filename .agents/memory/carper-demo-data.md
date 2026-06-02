---
name: Carper demo/test catalog data
description: Leftover demo rows from early backend verification that were removed.
---

Early backend verification inserted demo/test rows via executeSql that polluted the real Excel-seeded catalog:
- Products: 1001/1002/1003 (Batería/Alternador demos), LOCALTEST001, FINALTEST001
- Categories with numeric ids: "10" (Baterías), "20" (Alternadores), "30" (Marchas)

These were deleted. **Rule:** the products/categories/inventory tables should contain ONLY Excel-seeded data (category ids all start with `cat-`). If numeric category ids or LOCALTEST/FINALTEST product ids reappear, they are stray test data — safe to remove.

**Why:** real seed uses slugify → all category ids are `cat-*`; any other id is demo/test residue.
