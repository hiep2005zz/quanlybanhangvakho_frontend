with open('src/components/DashboardPage.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

injection = r'''
          {/* ACTIVE DISCOUNTS TABLE */}
          {(() => {
            try {
              const savedPolicies = localStorage.getItem('discountPolicies');
              if (savedPolicies) {
                const policies = JSON.parse(savedPolicies);
                const activePolicies = policies.filter((p: any) => p.status === 'active');
                if (activePolicies.length > 0) {
                  return (
                    <div style={{ marginBottom: '24px', background: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 12H16c-.7 2-3 3-4.9 3a5 5 0 0 1-5.1-3H2.5"/><path d="M2 12c0 5.5 4.5 10 10 10s10-4.5 10-10-4.5-10-10-10S2 6.5 2 12Z"/></svg>
                        Chính sách chiết khấu đang áp dụng
                      </h3>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                              <th style={{ padding: '10px 12px', fontWeight: '600', color: '#475569' }}>Mã CS</th>
                              <th style={{ padding: '10px 12px', fontWeight: '600', color: '#475569' }}>Sản phẩm áp dụng</th>
                              <th style={{ padding: '10px 12px', fontWeight: '600', color: '#475569' }}>Đối tượng</th>
                              <th style={{ padding: '10px 12px', fontWeight: '600', color: '#475569' }}>Thời hạn</th>
                              <th style={{ padding: '10px 12px', fontWeight: '600', color: '#475569' }}>Bậc chiết khấu</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activePolicies.map((p: any) => (
                              <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px 12px', fontWeight: '600', color: '#2563eb' }}>{p.code}</td>
                                <td style={{ padding: '10px 12px', fontWeight: '500', color: '#334155' }}>{p.title === 'Tất cả sản phẩm' ? <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>Tất cả SP</span> : p.title}</td>
                                <td style={{ padding: '10px 12px', color: '#475569' }}>{p.target_group === 'all' ? 'Tất cả đại lý' : p.target_group === 'agent_tier_1' ? 'Đại lý Cấp 1' : 'Đại lý Cấp 2'}</td>
                                <td style={{ padding: '10px 12px', color: '#64748b' }}>{p.start_date} - {p.end_date || 'Vô thời hạn'}</td>
                                <td style={{ padding: '10px 12px' }}>
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {p.tiers && p.tiers.map((t: any, idx: number) => (
                                      <span key={idx} style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #d1fae5', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
                                        Từ {t.min_quantity}sp: -{t.discount_percent}%
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                }
              }
            } catch (e) {}
            return null;
          })()}
'''

target_found = False
for i in range(len(lines)):
    if 'flexDirection: \'column\',' in lines[i] and 'gap: \'12px\',' in lines[i+1]:
        # This is where the accounts list starts, not the inventory. 
        # But wait, where is the inventory?
        pass
    if '<div className="kpi-stat-card">' in lines[i]:
        # Track where the KPI cards end
        pass
    if 'padding: \'0 4px\'' in lines[i] and 'marginBottom: \'16px\',' in lines[i-1]:
        # This is the search bar container header above the inventory table!
        target_found = True
        lines.insert(i-4, injection) # Insert before `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 4px' }}>`
        break

if target_found:
    with open('src/components/DashboardPage.tsx', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Injected successfully!")
else:
    print("Not found target!")
