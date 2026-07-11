# Meridian Permission Audit

Source of truth: `src/lib/role-context.tsx` (`Permission` type, `ROLE_HIERARCHY`, `ROLE_PERMISSIONS`, `hasPermission`).

Roles are listed highest access (system_admin, level 8) to lowest (nurse, level 1).

## 1. Role x Permission Matrix

Legend: `X` = granted, blank = not granted. Column headers abbreviated; full names in section 2.

| Permission \ Role      | sys_admin (8) | compliance (7) | legal_risk (6) | committee (5) | dept_admin (4) | nurse_educ (3) | physician (2) | nurse (1) |
|------------------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| view_sops              | X | X | X | X | X | X | X | X |
| query_ai               | X | X | X | X | X | X | X | X |
| create_proposal        | X | X |   | X | X | X | X |   |
| review_proposal        | X | X | X | X | X |   | X |   |
| vote_committee         | X |   |   | X |   |   |   |   |
| publish_sop            | X |   |   | X |   |   |   |   |
| archive_sop            | X |   |   |   |   |   |   |   |
| view_audit             | X | X | X | X | X |   |   |   |
| manage_users           | X |   |   |   |   |   |   |   |
| manage_sources         | X |   |   |   |   |   |   |   |
| legal_review           | X |   | X |   |   |   |   |   |
| view_compliance        | X | X | X | X | X | X |   |   |
| manage_training        | X |   |   |   |   | X |   |   |
| view_legal             | X | X | X |   |   |   |   |   |
| export_reports         | X | X | X |   |   |   |   |   |
| emergency_override     | X |   |   |   |   |   |   |   |
| manage_committee       | X |   |   | X |   |   |   |   |
| view_all_departments   | X | X |   |   | X |   |   |   |
| configure_system       | X |   |   |   |   |   |   |   |
| acknowledge_sop        | X |   |   |   |   |   |   | X |
| complete_training      | X |   |   |   |   |   |   | X |
| manage_acknowledgments | X | X |   |   | X |   |   |   |

(The three `system_admin` cells for `acknowledge_sop`, `complete_training`, `manage_acknowledgments` were added by this audit; see Findings.)

## 2. Permission Type (21 permissions)

view_sops, query_ai, create_proposal, review_proposal, vote_committee, publish_sop,
archive_sop, view_audit, manage_users, manage_sources, legal_review, view_compliance,
manage_training, view_legal, export_reports, emergency_override, manage_committee,
view_all_departments, configure_system, acknowledge_sop, complete_training,
manage_acknowledgments.

## 3. Page-Level Gating Inventory

Only `src/lib/role-context.tsx`'s `hasPermission` is a permission-based gate. All other page
gates are RAW ROLE CHECKS. Page files were read only (not edited).

### Permission-based gates (`hasPermission(...)`)
| File | Line | Gate |
|------|------|------|
| `src/app/query/page.tsx`     | 1092 | `hasPermission("create_proposal")` — shows "create proposal" affordance |
| `src/app/proposals/page.tsx` | 244  | `hasPermission("create_proposal")` — shows "new proposal" action |

### Raw role-check gates (`role === ...` / `role !== ...`)
| File | Line | Gate | Notes |
|------|------|------|-------|
| `src/app/admin/page.tsx` | 69 | `if (role !== "system_admin")` block access | Should map to `configure_system` / `manage_users` |
| `src/app/conflict-resolution/page.tsx` | 87 | `role === "system_admin"` | Could map to `emergency_override` |
| `src/app/training/page.tsx` | 137-139, 176, 405 | branches on `nurse` / `nurse_educator` | View selection + `nurse_educator` management block; management should map to `manage_training` |
| `src/app/dashboard/page.tsx` | 1075-1082 | per-role dashboard component selection | Presentation switch, not an access gate — raw role is appropriate here |
| `src/app/exceptions/page.tsx` | 129 | `canReview = role === "compliance_officer" \|\| role === "system_admin"` | No matching permission exists; see Findings |
| `src/app/legal/page.tsx` | 49 | `canEdit = role === "legal_risk" \|\| role === "compliance_officer" \|\| role === "system_admin"` | Overlaps `legal_review`; compliance_officer lacks `legal_review` though |
| `src/app/committee/page.tsx` | 155 | filters users by role list | Data filter, not an access gate |
| `src/app/proposals/page.tsx` | 179, 185 | `role === "committee_member"` / `role === "legal_risk"` | Maps to `vote_committee` / `legal_review` |
| `src/app/proposals/[id]/page.tsx` | 425, 441 | `role === "committee_member"` / `role === "legal_risk"` | Maps to `vote_committee` / `legal_review` |
| `src/app/settings/page.tsx` | 170, 179 | `role === r.id` | UI selection state, not a gate |
| `src/app/audit/page.tsx` | 77 | `e.user_role === roleFilter` | Data filter, not a gate |

## 4. Findings

### FIXED in this audit (within owned file `role-context.tsx`)
1. **system_admin was missing `acknowledge_sop`, `complete_training`, `manage_acknowledgments`.**
   Level 8 is documented as "Full platform control", yet it could not acknowledge an SOP,
   complete training, or manage acknowledgments — permissions held by lower roles (nurse,
   compliance_officer, dept_admin). Added all three so system_admin is a strict superset.
   No page currently references these three permissions, so this is forward-safe and changes
   no existing page behavior.

### NOT fixed (page-level; requires editing files owned by other agents — documented only)
2. **`src/app/admin/page.tsx:69` uses `role !== "system_admin"` instead of a permission.**
   A permission-based gate (`hasPermission("configure_system")` or `manage_users`) would be
   more correct and testable than a hard-coded role string.
3. **`src/app/exceptions/page.tsx:129` `canReview` has no backing permission.**
   Compliance officer + system_admin can review exceptions, but there is no
   `review_exceptions` (or similar) Permission. Consider adding one and gating on it. Left
   the Permission type unchanged because nothing references such a string yet (adding an
   unused permission would be dead code).
4. **`src/app/legal/page.tsx:49` `canEdit` includes `compliance_officer`, but
   compliance_officer does NOT hold `legal_review`.** If legal editing should be
   permission-driven, either grant `compliance_officer` a suitable permission or narrow the
   role list. This is a policy decision for the page owner; flagged, not changed.
5. **`src/app/training/page.tsx` management block (line 405) gates on
   `role === "nurse_educator"` while a `manage_training` permission exists** and is held by
   nurse_educator and system_admin. Using `hasPermission("manage_training")` would also let
   system_admin manage training on this page (currently it cannot, because the page keys off
   the raw role). Flagged for the page owner.
6. **Proposal/committee/legal gates use raw roles that duplicate existing permissions**
   (`vote_committee`, `legal_review`, `create_proposal`, `manage_committee`). Migrating these
   `role === ...` checks to `hasPermission(...)` would centralize policy and let system_admin
   (a superset) exercise them. Flagged, not changed.

### Verified
- **No permission string is referenced in any page that is missing from the `Permission` type.**
  Only `create_proposal` is used via `hasPermission`, and it is defined.
- **`hasPermission` cannot throw.** `ROLE_PERMISSIONS` defines an array for all 8 roles, and
  `role` is always a valid `UserRole` (defaulted to a real demo user). `.includes` on an
  always-present array is safe.
- **`ROLE_PERMISSIONS` covers all 8 roles.** After the fix, `system_admin` is a superset of
  every other role's permissions.
