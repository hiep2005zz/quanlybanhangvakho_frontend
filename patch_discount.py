import re
with open('src/components/DiscountPolicyView.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update imports
import_target = r"import \{ User \} from '\.\./services/api';"
import_injection = r"import { User, getProductsApi, Product } from '../services/api';"
text = re.sub(import_target, import_injection, text)

# 2. Add state and effect
state_target = r"const \[policies, setPolicies\] = useState<DiscountPolicy\[\]>\(\(\) => \{"
state_injection = r'''  const [products, setProducts] = useState<Product[]>([]);
  React.useEffect(() => {
    let active = true;
    getProductsApi(token).then(res => {
      if (active) setProducts(res.data);
    }).catch(() => {});
    return () => { active = false; };
  }, [token]);

  const [policies, setPolicies] = useState<DiscountPolicy[]>(() => {'''
text = re.sub(state_target, state_injection, text)

# 3. Replace the input field
# The label is "Tên chính sách *"
# Find: <label ...>Tên chính sách *</label>\s*<input ... />
input_target = r'''<label style=\{\{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' \}\}>\s*Tên chính sách \*\s*<\/label>\s*<input[^>]+>'''
input_injection = r'''<label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                    Sản phẩm áp dụng *
                  </label>
                  <select
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}
                  >
                    <option value="">-- Chọn sản phẩm --</option>
                    <option value="Tất cả sản phẩm">Tất cả sản phẩm</option>
                    {products.map(p => (
                      <option key={p.id} value={`${p.sku} - ${p.name}`}>{p.sku} - {p.name}</option>
                    ))}
                  </select>'''
text = re.sub(input_target, input_injection, text)

with open('src/components/DiscountPolicyView.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated successfully")
