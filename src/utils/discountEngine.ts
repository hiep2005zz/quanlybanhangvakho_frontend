import { DiscountPolicy, DiscountTier } from '../services/api';

export interface EvaluatedDiscountResult {
  policy: DiscountPolicy | null;
  tier: DiscountTier | null;
  discountPercent: number;
  discountAmount: number;
  label: string | null;
  isQualified: boolean;
}

export function parseStoredPolicies(): DiscountPolicy[] {
  try {
    const raw = localStorage.getItem('discountPolicies');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function evaluateBestDiscountPolicy(
  policies: DiscountPolicy[],
  items: Array<{ productId?: number; quantity: number; price: number; name?: string; code?: string }>,
  dealer?: { id?: number | string; customer_group?: string; name?: string } | null,
  overrideTotalQty?: number,
  overrideSubtotal?: number
): EvaluatedDiscountResult {
  const totalQuantity = overrideTotalQty !== undefined
    ? overrideTotalQty
    : items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const subtotal = overrideSubtotal !== undefined
    ? overrideSubtotal
    : items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0), 0);

  const nowStr = new Date().toISOString().split('T')[0];
  const dealerGroupStr = (dealer?.customer_group || '').toLowerCase();

  let bestResult: EvaluatedDiscountResult = {
    policy: null,
    tier: null,
    discountPercent: 0,
    discountAmount: 0,
    label: null,
    isQualified: false,
  };

  for (const policy of policies) {
    // 1. Kiểm tra trạng thái kích hoạt
    const isActive =
      (policy.status === 'active' || policy.is_active === true) &&
      policy.status !== 'expired' &&
      policy.status !== 'draft';
    if (!isActive) continue;

    // 2. Kiểm tra ngày hiệu lực nếu có
    if (policy.start_date && policy.start_date > nowStr) continue;
    if (policy.end_date && policy.end_date < nowStr) continue;

    // 3. Kiểm tra đối tượng đại lý áp dụng
    const target = (policy.target_dealer_type || policy.target_group || 'all').toLowerCase();
    if (target !== 'all' && target !== 'all_dealers') {
      if (target === 'agent_tier_1' || target.includes('cap_1') || target.includes('cấp 1')) {
        if (!dealerGroupStr.includes('cấp 1') && !dealerGroupStr.includes('cap_1') && !dealerGroupStr.includes('cap 1')) {
          continue;
        }
      } else if (target === 'agent_tier_2' || target.includes('cap_2') || target.includes('cấp 2')) {
        if (!dealerGroupStr.includes('cấp 2') && !dealerGroupStr.includes('cap_2') && !dealerGroupStr.includes('cap 2')) {
          continue;
        }
      }
    }

    // 4. Xác định số lượng tính theo sản phẩm hay tổng đơn
    const polTitle = (policy.title || policy.name || '').trim();
    const polCat = (policy.category || 'ALL').toUpperCase();

    let qtyToCheck = totalQuantity;
    if (polCat !== 'ALL' && polTitle && polTitle !== 'Tất cả sản phẩm') {
      // Chính sách cho sản phẩm cụ thể
      const matchedQty = items.reduce((sum, it) => {
        const pName = it.name || '';
        const pCode = it.code || '';
        if (polTitle.includes(pCode) || polTitle.includes(pName) || pName.includes(polTitle)) {
          return sum + (Number(it.quantity) || 0);
        }
        return sum;
      }, 0);
      qtyToCheck = matchedQty;
    }

    if (qtyToCheck <= 0) continue;

    // 5. Kiểm tra các bậc sản lượng
    const tiers = Array.isArray(policy.tiers) ? policy.tiers : [];
    for (const tier of tiers) {
      const minQ = Number(tier.min_quantity) || 0;
      const maxQ = tier.max_quantity !== null && tier.max_quantity !== undefined ? Number(tier.max_quantity) : null;
      const tierPct = Number(tier.discount_percent) || 0;

      if (qtyToCheck >= minQ && (maxQ === null || qtyToCheck <= maxQ)) {
        const tierDiscountAmount = Math.round((subtotal * tierPct) / 100);

        // Best Price Rule: Chọn chính sách có mức tiền giảm cao nhất (hoặc tỷ lệ % cao nhất)
        if (
          tierDiscountAmount > bestResult.discountAmount ||
          (tierDiscountAmount === bestResult.discountAmount && tierPct > bestResult.discountPercent)
        ) {
          const tierRangeStr = maxQ ? `từ ${minQ} đến ${maxQ} sp` : `từ ${minQ} sp`;
          const policyCode = policy.code || 'CK';
          const label = `Đã áp dụng ${policyCode}: Giảm ${tierPct}% cho đơn ${tierRangeStr}`;

          bestResult = {
            policy,
            tier,
            discountPercent: tierPct,
            discountAmount: tierDiscountAmount,
            label,
            isQualified: true,
          };
        }
      }
    }
  }

  return bestResult;
}
