-- DEC-01: a non-SUPER_ADMIN user always has an institute. Prisma cannot express this check, so it is added here.
ALTER TABLE "User" ADD CONSTRAINT "User_tenant_scope_check" CHECK ("role" = 'SUPER_ADMIN' OR "instituteId" IS NOT NULL);

-- DEC-01: a staff invite can never create a SUPER_ADMIN account.
ALTER TABLE "UserInvite" ADD CONSTRAINT "UserInvite_no_super_admin_check" CHECK ("role" <> 'SUPER_ADMIN');
