import type { Metadata } from 'next';
import { Icon } from '@/components/Icon';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { PasswordResultForm } from '@/components/admin/PasswordResultForm';
import { formatDateTime, PageTitle } from '@/components/admin/ui';
import { requireRole } from '@/lib/auth';
import { createUserClient } from '@/lib/supabase/clients';
import { createStaff, removeStaff, resetStaffPassword, updateStaff } from './actions';

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
          <div className="field" style={{ alignSelf: 'end' }}><SubmitButton><Icon name="plus" size={16} />Add member</SubmitButton></div>
        </PasswordResultForm>
      </section>

      <section className="card">
        <div className="table-wrap">
          <table className="table table--stack">
            <caption className="visually-hidden">Team members</caption>
            <thead><tr><th scope="col">Person</th><th scope="col">Edit name, role and access</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {(people ?? []).map(p => {
                const self = p.id === me.id;
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.full_name || '—'}</strong>{self && <span className="badge badge--info" style={{ marginLeft: 6 }}>You</span>}
                      {!p.active && <span className="badge" style={{ marginLeft: 6 }}>No access</span>}
                      {p.must_change_password && <span className="badge badge--pending" style={{ marginLeft: 6 }}>Must set password</span>}
                      <br /><span className="text-muted">{p.email}</span><br /><span className="text-xs text-muted">Added {formatDateTime(p.created_at)}</span>
                    </td>
                    <td>
                      <ActionForm action={updateStaff} className="flex flex-wrap gap-3 items-center">
                        <input type="hidden" name="id" value={p.id} />
                        <label className="visually-hidden" htmlFor={`name-${p.id}`}>Name for {p.email}</label>
                        <input className="input input--sm" id={`name-${p.id}`} name="full_name" defaultValue={p.full_name} required minLength={2} maxLength={80} />
                        {self ? (
                          <span className="text-sm text-muted">{p.role === 'admin' ? 'Administrator' : 'Staff'} (another administrator can change your role)</span>
                        ) : (
                          <>
                            <label className="visually-hidden" htmlFor={`role-${p.id}`}>Role for {p.email}</label>
                            <select className="select select--sm" id={`role-${p.id}`} name="role" defaultValue={p.role}><option value="staff">Staff</option><option value="admin">Administrator</option></select>
                            <label className="check"><input type="checkbox" name="active" defaultChecked={p.active} /> Has access</label>
                          </>
                        )}
                        <SubmitButton size="sm" variant="outline">Save</SubmitButton>
                      </ActionForm>
                    </td>
                    <td>
                      {!self && (
                        <div className="row-actions">
                          <PasswordResultForm action={resetStaffPassword} confirm={`Reset the password for ${p.email}?`} className="">
                            <input type="hidden" name="id" value={p.id} />
                            <SubmitButton size="sm" variant="ghost">Reset password</SubmitButton>
                          </PasswordResultForm>
                          <ActionForm action={removeStaff} className="" confirm={`Remove ${p.full_name || p.email} from the team? They will lose access straight away. If they have notes or bookings on record, the account is switched off instead of deleted, so the history is kept.`}>
                            <input type="hidden" name="id" value={p.id} />
                            <SubmitButton size="sm" variant="ghost-danger"><Icon name="trash" size={16} />Remove</SubmitButton>
                          </ActionForm>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
