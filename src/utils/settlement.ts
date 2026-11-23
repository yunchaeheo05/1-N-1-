export type RoundingOption = 'round-up-100' | 'exact';

export interface RoundInputItem {
  id: string;
  amount: number;
  peopleCount: number;
}

export interface RoundSettlementDetail {
  id: string;
  roundNumber: number;
  amount: number;
  peopleCount: number;
  rawPerPerson: number;
  perPersonAmount: number;
  collectedAmount: number;
  surplusAmount: number;
}

export interface MultiRoundSettlementResult {
  roundingOption: RoundingOption;
  rounds: RoundSettlementDetail[];
  totalAmount: number;
  totalPerPersonAllRounds: number;
  totalCollected: number;
  totalSurplus: number;
}

export function formatKRW(amount: number): string {
  return Math.round(amount).toLocaleString('ko-KR');
}

export function parseNumericInput(raw: string, max = 1_000_000_000): number {
  const digitsOnly = raw.replace(/[^0-9]/g, '');
  if (!digitsOnly) return 0;
  const parsed = Number(digitsOnly);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(parsed, max);
}

export function calculateMultiRoundSettlement(
  rounds: RoundInputItem[],
  roundingOption: RoundingOption
): MultiRoundSettlementResult {
  const roundDetails: RoundSettlementDetail[] = rounds.map((item, idx) => {
    const safePeople = Math.max(1, Math.floor(item.peopleCount));
    const safeAmount = Math.max(0, Math.floor(item.amount));
    const rawPerPerson = safeAmount / safePeople;

    const perPersonAmount =
      roundingOption === 'round-up-100'
        ? Math.ceil(rawPerPerson / 100) * 100
        : Math.ceil(rawPerPerson);

    const collectedAmount = perPersonAmount * safePeople;
    const surplusAmount = collectedAmount - safeAmount;

    return {
      id: item.id,
      roundNumber: idx + 1,
      amount: safeAmount,
      peopleCount: safePeople,
      rawPerPerson,
      perPersonAmount,
      collectedAmount,
      surplusAmount,
    };
  });

  const totalAmount = roundDetails.reduce((acc, r) => acc + r.amount, 0);
  const totalPerPersonAllRounds = roundDetails.reduce((acc, r) => acc + r.perPersonAmount, 0);
  const totalCollected = roundDetails.reduce((acc, r) => acc + r.collectedAmount, 0);
  const totalSurplus = totalCollected - totalAmount;

  return {
    roundingOption,
    rounds: roundDetails,
    totalAmount,
    totalPerPersonAllRounds,
    totalCollected,
    totalSurplus,
  };
}

export function buildMultiRoundNoticeText(
  result: MultiRoundSettlementResult,
  options?: {
    gatheringName?: string;
    bankAccount?: string;
  }
): string {
  const gatheringName = options?.gatheringName?.trim();
  const bankAccount = options?.bankAccount?.trim();

  const title = gatheringName ? `[${gatheringName} 정산 안내]` : '[모임 더치페이 정산 안내]';
  const roundingLabel =
    result.roundingOption === 'round-up-100' ? '100원 단위 올림' : '1원 단위 정확 정산';

  const lines: string[] = [title];

  if (result.rounds.length === 1) {
    const only = result.rounds[0];
    lines.push('오늘 모임 함께해 주셔서 감사합니다! 정산 금액 안내드려요.');
    lines.push('');
    lines.push(`• 1차 결제 금액: ${formatKRW(only.amount)}원`);
    lines.push(`• 참여 인원: ${only.peopleCount}명`);
    lines.push(`• 1인당 보낼 금액: ${formatKRW(only.perPersonAmount)}원 (${roundingLabel})`);
  } else {
    lines.push('오늘 모임 함께해 주셔서 감사합니다! 차수별 정산 금액 안내드려요.');
    lines.push('');
    result.rounds.forEach((r) => {
      lines.push(
        `• ${r.roundNumber}차: ${formatKRW(r.amount)}원 ÷ ${r.peopleCount}명 → 1인당 ${formatKRW(r.perPersonAmount)}원`
      );
    });
    lines.push('');
    lines.push(`▶ 전체 합산 결제 금액: ${formatKRW(result.totalAmount)}원`);
    lines.push(
      `▶ 전 차수 참석 시 1인당 합계: ${formatKRW(result.totalPerPersonAllRounds)}원 (${roundingLabel})`
    );
    lines.push('  (본인이 참석한 차수 금액만 합산해서 보내주세요!)');
  }

  if (result.totalSurplus > 0 && result.roundingOption === 'round-up-100') {
    lines.push(`  ※ 100원 단위 올림 차액(+${formatKRW(result.totalSurplus)}원)은 다음 모임에 보탤게요.`);
  }

  if (bankAccount) {
    lines.push(`• 입금 계좌: ${bankAccount}`);
  }

  lines.push('');
  lines.push('확인 후 편하실 때 송금 부탁드립니다!');

  return lines.join('\n');
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below when Clipboard API is restricted in embedded iframes
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const succeeded = document.execCommand('copy');
    document.body.removeChild(textarea);
    return succeeded;
  } catch {
    return false;
  }
}
