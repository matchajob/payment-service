---
name: request-schema-source-of-truth
description: This skill should be used when the user reports "registration error the tests didn't catch", "form and server disagree", "validation didn't catch X", "why did DZD not catch this", "opaque 500 on register/submit", "the form says valid but the server rejects", or when adding/reviewing any tRPC procedure whose input mirrors a client form (auth.register*, profile create/update, onboarding submits), or a *-props.ts field's requiredness/type doesn't match its DZD/DB column. Covers why request-DTO schemas drift from the DZD form props despite green tests, why a form-props field can independently drift from the DZD/DB schema it's supposed to derive from, and the single-source-of-truth rules that prevent both.
version: 0.1.0
---

# Request Schema = Form Schema (one object, not two)

A tRPC procedure's `.input()` and the client form it serves must be **the same Zod object**, not two hand-written copies. Two copies drift; drift slips past both the tests and DZD; bad input then dies three layers down at the DB as an opaque 500 instead of a field-level 400.

---

## The rule

- The form props schema in `src/lib/forms/*-props.ts` is the **single source of truth**.
- The server imports it: `procedure.input(zXxxRegisterProps)`. Never re-declare the shape inline in the router.
- `src/trpc` may import `src/lib/forms` (lib/domain) — same as it imports `@/lib/db`, `@/lib/auth`. No layer violation.

```ts
// src/lib/forms/employer-register-props.ts  ← source of truth (form builds from this)
export const zEmployerRegisterProps = zLoginProps.extend({ /* ... */ });

// src/trpc/routers/auth.ts  ← server reuses the SAME object
registerEmployer: publicProcedure
  .input(zEmployerRegisterProps)   // ✅ not a hand-copied z.object
  .mutation(...)
```

---

## Why drift slips past the safety nets

- **DZD protects entities, not request DTOs.** It keeps `*_table` ⟷ derived Zod ⟷ Drizzle columns in lockstep. A registration request is a hand-assembled `z.object` that cherry-picks `.shape.X` off entities and splices in raw `z.string().min(1)`. The moment you hand-write a field, you are outside DZD's guarantee.
- **Tests validate the server in isolation** against curated `VALID_INPUT` literals that satisfy *both* copies. Nothing asserts `server.input ≡ form props`, so the gap is invisible.
- **A schema gap fails at the DB, not the schema.** Example that actually shipped: server `businessTypes: z.array(z.string())` accepted `['']`; the form's `z.array(...nonEmpty)` rejected it. The empty string passed server Zod → hit a non-empty PK column → CHECK violation → `INTERNAL_SERVER_ERROR` (500). No field error.

---

## When you spot two schemas: unify, don't add a drift test

1. Move/keep the canonical shape in `src/lib/forms/*-props.ts`.
2. Replace the router's inline `.input({...})` with `.input(zXxxProps)`.
3. Delete now-unused imports in the router (the cherry-picked `.shape` sources, standalone validators).
4. Format checks that aren't expressible as a DB constraint (national-id/business-registration checksums) go on the **shared** schema as a `.refine()` on top of the DZD-derived field (e.g. `zEmployerProfileCreate.shape.ownerNationalId.refine(isValidIsraeliId, {...})`) — see "Form field drift from its own DZD/DB schema" below — so the form validates it too, before submit.
5. A required field changes test fixtures: add a valid value to every `VALID_INPUT`, and fix any "accepts null/undefined for optional" test that named the now-required field.

---

## Form field drift from its own DZD/DB schema

A second, independent drift axis: a field *inside* a `*-props.ts` schema can quietly stop matching the DZD/DB column it's supposed to represent. Real example: `employee-register-props.ts` had `phone: zPhone.optional()` — a fully standalone schema — while `employeeIdentities.ts` still had `phone` marked `isOptional: true, isNullable: true`. Someone made phone required *only* in the form layer. The DB stayed permissive, so a direct DB write (a script, an admin console) could still leave `phone` null — the requiredness "fix" wasn't real, it was cosmetic.

**Prefer generation over verification.** Don't hand-copy a field and then write a test to catch when the copy drifts — structure the code so drift can't compile in the first place:

```ts
// ❌ smell: omit fields from the spread just to hand-restate them right after
export const zEmployeeRegisterProps = zLoginProps.extend({
  nationalId: zNationalId,
  ...zEmployeeIdentityCreate.omit({ userId: true, nationalId: true, phone: true, birthdate: true }).shape,
  phone:      zEmployeeIdentityCreate.shape.phone.refine(isValidIsraeliPhone, { message: PHONE_MESSAGE }),
  birthdate:  zEmployeeIdentityCreate.shape.birthdate.refine(isValidBirthdate, { message: BIRTHDATE_MESSAGE }),
});

// ✅ .extend() chain: no omit bookkeeping, no ordering trap
export const zEmployeeRegisterProps = zLoginProps
  .extend({ name: zUserCreate.shape.name, location: zUserCreate.shape.location })
  // every employeeIdentities create-field with no extra validation (city, address, gender, phone,
  // birthdate) is pulled in as-is — a new DB column shows up here automatically, nothing to add.
  .extend(zEmployeeIdentityCreate.omit({ userId: true }).shape)
  // fields needing an extra domain check (checksum/format/range) get refined on the SAME schema
  // object. .extend()'s own type-level merge (util.Extend<A,B>) resolves overlapping keys to B —
  // that's its designed purpose (zod deprecated .merge() in favor of it) — so overriding never
  // requires omitting the field from the layer above first.
  .extend({
    nationalId: zNationalId,
    phone:      zEmployeeIdentityCreate.shape.phone.refine(isValidIsraeliPhone, { message: PHONE_MESSAGE }),
    birthdate:  zEmployeeIdentityCreate.shape.birthdate.refine(isValidBirthdate, { message: BIRTHDATE_MESSAGE }),
  });
```

Why the omit+spread version is a real smell, not just style: TypeScript itself only half-covers it. Remove a field from `.omit()` when its explicit override sits *before* the spread → `TS2783: 'x' is specified more than once, so this usage will be overwritten` (a real compile error — the spread would silently clobber your override). Remove it when the override sits *after* the spread → **zero errors**, because "later key wins" is the idiomatic override pattern and TS doesn't flag it. So the omit list's correctness silently depends on where in the object literal you happened to write things, with no consistent signal either way. `.extend()` removes the ambiguity entirely: the second `.extend()` call always wins over the first, by definition, regardless of what it does or doesn't repeat.

**For fields needing a `.refine()`, this is as far as generation goes** — DZD can't express "valid Israeli mobile format" as a column type, so the extra check has to be hand-written. What can still be generated is the *base type*: pull the field from `zEmployeeIdentityCreate.shape.X` and refine it, don't build a disconnected `z.string()...` from scratch (that's exactly how the phone bug happened). Add a compile-time drift test as the guard for this remaining seam:

```ts
type _drift_phone = Expect<Equals<Shape['phone'], (typeof zEmployeeIdentityCreate)['shape']['phone']>>;
```

This works *through* the `.refine()` because Zod v4 changed `.refine()`'s return type: for a plain boolean predicate (not a type guard), `refine()` returns `this` — the exact same type as the schema it was called on — not a wrapping `ZodEffects<T>` like Zod v3. So `zEmployeeIdentityCreate.shape.phone.refine(fn, {...})` is still literally the same TS type as `zEmployeeIdentityCreate.shape.phone`, and `Equals` can compare straight through.

**Prove a drift test is real before trusting it** — a vacuous `Equals` (e.g. both sides collapsing to `any`) passes for the wrong reason. Temporarily reintroduce the exact bug and confirm `tsc --noEmit` fails at that line, then revert:

```bash
# add .optional() (or swap in an unrelated schema) to simulate the drift, then:
npx tsc --noEmit -p .   # must fail with "Type 'false' does not satisfy the constraint 'true'"
# revert, then confirm clean again
```

**When the drift reveals the DB is the one that's wrong** (form has been requiring a field the DB still allows null/empty on — this is usually the case, since the app's UI already gates on it before the DB catches up): fixing it means changing the DZD field config (drop `isOptional`/switch `emptyable`→`nonEmpty`), which needs a real migration. Before generating it, check prod for existing rows that would violate the new constraint (`select count(*) from t where col is null or col = ''`) — see the **deploy-backend** skill for the migration flow, and don't apply if rows would be blocked without a data decision from the user first.

---

## Compile-time contract guard (catches shape drift)

Lives in `src/trpc/index.ts` (the only spot that can import both `AppRouter` and `lib/forms` without a cycle or a `lib→trpc` layer violation; `tests/` is **not** in the `tsc` include, so the guard can't live there). One assertion per form-backed procedure:

```ts
type _Inputs = inferRouterInputs<AppRouter>
type _contract_registerEmployer = Expect<Equals<
  _Inputs['auth']['registerEmployer'],
  z.input<typeof zEmployerRegisterProps>
>>
```

If a procedure's `.input()` drifts in shape (field added/removed, optional↔required, wrong type), `Equals` resolves to `false`, `Expect<false>` is rejected, and `tsc --noEmit -p tsconfig.json` fails at this line. **Limit:** TS erases refinements, so `z.string()` vs `z.string().min(1)` (or `z.array(z.string())` vs an array of a string-enum) both infer `string`/`string[]` and slip past — that class is covered by the runtime test below. Add one assertion per new form-backed procedure.

## Regression test pattern (proves the error is indicative)

Assert rejection happens **at validation**, before auth/DB — that is what makes a 400 instead of a 500:

```ts
it('rejects an empty-string businessType with a clean 400, not an opaque 500', async () => {
  setupSuccessfulAuth();
  try {
    await publicCaller.auth.registerEmployer({ ...VALID_INPUT, businessTypes: ['food.restaurant', ''] });
    throw new Error('expected rejection');
  } catch (err) {
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe('BAD_REQUEST');   // not INTERNAL_SERVER_ERROR
  }
  expect(mockCreateUser).not.toHaveBeenCalled();           // failed before side effects
});
```

The `not.toHaveBeenCalled()` line is the point: it pins the failure to the schema layer.

---

## Review checklist for any form-backed procedure

- [ ] `.input()` is an imported `*-props` object, not an inline `z.object`/`.extend`.
- [ ] Every field the form sends exists in that schema (watch for fields collected in form state but absent from props — e.g. `gender`).
- [ ] Requiredness matches the form's step gate AND the submit call (`x || undefined` at submit = the schema must mark `x` optional; a required field should drop the `|| undefined`).
- [ ] Format validators (`isValidIsraeliId`, `isValidBusinessRegistration`, `isValidIsraeliPhone`) are `.refine()`'d onto the DZD-derived field, not a disconnected standalone schema.
- [ ] Every field derived from a DZD create shape either passes through an `.extend(...create.omit({...}).shape)` untouched, or is overridden in a *later* `.extend({...})` call — never via `.omit()` + hand-restate.
- [ ] Every `.refine()`'d field has a `_drift_x` compile-time test (`src/lib/forms/*.test-d.ts`) comparing it against `(typeof zXxxCreate)['shape']['x']`.
- [ ] At least one test feeds an input the form would reject and asserts `BAD_REQUEST` + no side effects.

---

## Status

`registerEmployee` and `registerEmployer` are both unified (2026-07) and fully `.extend()`-chained off their DZD create shapes — `zEmployeeRegisterProps` (city/address/gender/phone/birthdate/name/location from `employeeIdentities`/`users`, `phone`/`birthdate` refined) and `zEmployerRegisterProps` (businessAddress/businessDomain/ownerNationalId/businessRegistrationNumber from `employerProfiles`, the latter two refined). `phone`, `ownerNationalId`, `businessRegistrationNumber`, `businessDomain` were all fixed from the "required in the form, optional in the DZD/DB" drift described above, each with a matching migration (checked prod for violating rows first, applied `SET NOT NULL`/`CHECK` after confirming safe). Every refined field has a `_drift_x` compile-time test.

Remaining known TODO: `employeeIdentities.nationalId` requiredness is unified, but its checksum lives only in the form-props `.refine()` — a direct DB write can still store a checksum-invalid ID. Pushing the checksum into a DZD theme so the DB-layer create schema validates it too is tracked but not done.
