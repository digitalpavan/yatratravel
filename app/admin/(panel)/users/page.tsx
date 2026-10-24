import type { Metadata } from 'next';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { PasswordResultForm } from '@/components/admin/PasswordResultForm';
import { formatDateTime, PageTitle } from '@/components/admin/ui';
import { requireRole } from '@/lib/auth';
import { createUserClient } from '@/lib/supabase/clients';
import { createStaff, resetStaffPassword, updateStaff } from './actions';

export const metadata: Metadata = { title: 'Staff & roles' };

export default async function UsersPage() {
  const me = await requireRole('admin');
  const db = await createUserClient();
  const { data: people } = await db.from('profiles').select('id, email, full_name, role, active, must_change_password, created_at').order('created_at');

  return (
    <>
      <PageTitle title="Staff & roles" sub="Staff manage bookings, enquiries and vehicle availability. Administrators can also change packages, content, accounts and exports." />

      <section className="card card--pad" aria-labelledby="add-title">
        <h2 id="add-title" className="h4">Add a team member</h2>
        <PasswordResultForm action={createStaff} className="form-grid form-grid--4 mt-4">
          <div className="field"><label className="label" htmlFor="full_name">Name</label><input className="input" id="full_name" name="full_name" required /></div>
          <div className="field"><label className="label" htmlFor="email">Work email</label><input className="input" id="email" name="email" type="email" required /></div>
          <div className="field"><label className="label" htmlFor="role">Role</label><select className="select" id="role" name="role" defaultValue="staff"><option value="staff">Staff</option><option value="admin">Administrator</option></select></div>
          <div className="field" style={{ alignSelf: 'end' }}><SubmitButton>Create account</SubmitButton></div>
        </PasswordResultForm>
      </section>

      <section className="card">
        <div className="table-wrap">
          <table className="table table--stack">
            <caption className="visually-hidden">Team members</caption>
            <thead><tr><th scope="col">Person</th><th scope="col">Role and access</th><th scope="col">Password</th></tr></thead>
            <tbody>
              {(people ?? []).map(p => (
                <tr key={p.id}>
                  <td><strong>{p.full_name || '—'}</strong>{p.id === me.id && <span className="badge badge--info" style={{ marginLeft: 6 }}>You</span>}<br /><span className="text-muted">{p.email}</span><br /><span className="text-xs text-muted">Added {formatDateTime(p.created_at)}</span></td>
                  <td>
                    {p.id === me.id ? <span className="text-sm text-muted">{p.role === 'admin' ? 'Administrator' : 'Staff'} (another administrator can change this)</span> : (
                      <ActionForm action={updateStaff} className="flex flex-wrap gap-3 items-center">
                        <input type="hidden" name="id" value={p.id} />
                        <label className="visually-hidden" htmlFor={`role-${p.id}`}>Role for {p.email}</label>
                        <select className="select select--sm" id={`role-${p.id}`} name="role" defaultValue={p.role}><option value="staff">Staff</option><option value="admin">Administrator</option></select>
                        <label className="check"><input type="checkbox" name="active" defaultChecked={p.active} /> Has access</label>
                        <SubmitButton size="sm" variant="outline">Save</SubmitButton>
                      </ActionForm>
                    )}
                  </td>
                  <td>
                    {p.must_change_password && <span className="badge badge--pending">Must set password</span>}
                    {p.id !== me.id && (
                      <PasswordResultForm action={resetStaffPassword} confirm={`Reset the password for ${p.email}?`} className="mt-2">
                        <input type="hidden" name="id" value={p.id} />
                        <SubmitButton size="sm" variant="ghost">Reset password</SubmitButton>
                      </PasswordResultForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
