import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import NewUserButton from "./NewUserButton";
import UserRow from "./UserRow";

export default async function UsersPage() {
  const me = await requireAdmin();

  const users = await db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Kullanıcılar</h2>
          <div className="sub">Ekip üyelerini yönetin</div>
        </div>
        <div className="spacer" />
        <NewUserButton />
      </div>

      <div className="content">
        {users.map((u) => (
          <UserRow
            key={u.id}
            isSelf={u.id === me.id}
            u={{ id: u.id, username: u.username, name: u.name, role: u.role, active: u.active }}
          />
        ))}
      </div>
    </>
  );
}
