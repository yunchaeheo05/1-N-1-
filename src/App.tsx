import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import {
  buildMultiRoundNoticeText,
  calculateMultiRoundSettlement,
  copyTextToClipboard,
  formatKRW,
  parseNumericInput,
  type MultiRoundSettlementResult,
  type RoundingOption,
} from './utils/settlement';

interface RoundFormState {
  id: string;
  amountInput: string;
  peopleCount: number;
}

const PRESET_PEOPLE = [2, 3, 4, 5, 6];

const QUICK_ADD_AMOUNTS = [
  { label: '+1만원', value: 10_000 },
  { label: '+3만원', value: 30_000 },
  { label: '+5만원', value: 50_000 },
  { label: '+10만원', value: 100_000 },
];

function createRound(id: string, defaultPeople = 4, amountInput = ''): RoundFormState {
  return {
    id,
    amountInput,
    peopleCount: defaultPeople,
  };
}

export default function App() {
  const nextIdRef = useRef<number>(2);
  const [rounds, setRounds] = useState<RoundFormState[]>([createRound('round-1', 4, '')]);
  const [roundingOption, setRoundingOption] = useState<RoundingOption>('round-up-100');

  const [gatheringName, setGatheringName] = useState<string>('');
  const [bankAccount, setBankAccount] = useState<string>('');

  const [result, setResult] = useState<MultiRoundSettlementResult | null>(null);
  const [lastCalculatedSignature, setLastCalculatedSignature] = useState<string>('');
  const [errorRoundIds, setErrorRoundIds] = useState<string[]>([]);
  const [validationMessage, setValidationMessage] = useState<string>('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const resultSectionRef = useRef<HTMLElement | null>(null);

  const parsedRounds = useMemo(
    () =>
      rounds.map((r) => ({
        id: r.id,
        amount: parseNumericInput(r.amountInput),
        peopleCount: Math.max(1, r.peopleCount),
      })),
    [rounds]
  );

  const liveTotalAmount = useMemo(
    () => parsedRounds.reduce((sum, r) => sum + r.amount, 0),
    [parsedRounds]
  );

  const currentSignature = useMemo(
    () =>
      JSON.stringify({
        rounds: parsedRounds,
        roundingOption,
      }),
    [parsedRounds, roundingOption]
  );

  const isStale = result !== null && currentSignature !== lastCalculatedSignature;

  const noticeText = useMemo(() => {
    if (!result) return '';
    return buildMultiRoundNoticeText(result, { gatheringName, bankAccount });
  }, [result, gatheringName, bankAccount]);

  const clearValidationForRound = (id: string) => {
    if (errorRoundIds.includes(id)) {
      const remaining = errorRoundIds.filter((errId) => errId !== id);
      setErrorRoundIds(remaining);
      if (remaining.length === 0) {
        setValidationMessage('');
      }
    }
  };

  const handleAmountChange = (id: string, rawValue: string) => {
    const parsed = parseNumericInput(rawValue);
    setRounds((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, amountInput: parsed > 0 ? formatKRW(parsed) : '' } : r
      )
    );
    clearValidationForRound(id);
  };

  const handleQuickAddAmount = (id: string, delta: number) => {
    setRounds((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const nextAmount = Math.min(parseNumericInput(r.amountInput) + delta, 1_000_000_000);
        return { ...r, amountInput: formatKRW(nextAmount) };
      })
    );
    clearValidationForRound(id);
  };

  const handlePeopleCountChange = (id: string, nextCount: number) => {
    const clamped = Math.max(1, Math.min(99, Math.floor(nextCount)));
    setRounds((prev) =>
      prev.map((r) => (r.id === id ? { ...r, peopleCount: clamped } : r))
    );
  };

  const handlePeopleInputChange = (id: string, rawValue: string) => {
    const digitsOnly = rawValue.replace(/[^0-9]/g, '');
    if (!digitsOnly) {
      setRounds((prev) =>
        prev.map((r) => (r.id === id ? { ...r, peopleCount: 1 } : r))
      );
      return;
    }
    const parsed = parseNumericInput(digitsOnly, 99);
    handlePeopleCountChange(id, Math.max(1, parsed));
  };

  const handleAddRound = () => {
    const newId = `round-${nextIdRef.current++}`;
    const lastPeople = rounds[rounds.length - 1]?.peopleCount ?? 4;
    setRounds((prev) => [...prev, createRound(newId, lastPeople, '')]);
    setValidationMessage('');
  };

  const handleRemoveRound = (id: string) => {
    if (rounds.length <= 1) return;
    setRounds((prev) => prev.filter((r) => r.id !== id));
    clearValidationForRound(id);
  };

  const handleCalculate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const invalidIds = parsedRounds.filter((r) => r.amount <= 0).map((r) => r.id);
    if (invalidIds.length > 0) {
      setErrorRoundIds(invalidIds);
      setValidationMessage('모든 차수의 결제 금액을 1원 이상 입력해 주세요.');
      return;
    }

    setErrorRoundIds([]);
    setValidationMessage('');

    const computed = calculateMultiRoundSettlement(parsedRounds, roundingOption);
    setResult(computed);
    setLastCalculatedSignature(currentSignature);
    setCopyStatus('idle');

    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      requestAnimationFrame(() => {
        resultSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  };

  const handleApplyExample = () => {
    const id1 = `round-${nextIdRef.current++}`;
    const id2 = `round-${nextIdRef.current++}`;
    const sampleForms: RoundFormState[] = [
      createRound(id1, 4, '120,000'),
      createRound(id2, 3, '75,000'),
    ];
    setRounds(sampleForms);
    setRoundingOption('round-up-100');
    setErrorRoundIds([]);
    setValidationMessage('');

    const sampleInput = [
      { id: id1, amount: 120_000, peopleCount: 4 },
      { id: id2, amount: 75_000, peopleCount: 3 },
    ];
    const computed = calculateMultiRoundSettlement(sampleInput, 'round-up-100');
    setResult(computed);
    setLastCalculatedSignature(
      JSON.stringify({
        rounds: sampleInput,
        roundingOption: 'round-up-100',
      })
    );
    setCopyStatus('idle');
  };

  const handleReset = () => {
    const freshId = `round-${nextIdRef.current++}`;
    setRounds([createRound(freshId, 4, '')]);
    setRoundingOption('round-up-100');
    setGatheringName('');
    setBankAccount('');
    setResult(null);
    setLastCalculatedSignature('');
    setErrorRoundIds([]);
    setValidationMessage('');
    setCopyStatus('idle');
  };

  const handleCopyNotice = async () => {
    if (!noticeText) return;
    const ok = await copyTextToClipboard(noticeText);
    setCopyStatus(ok ? 'copied' : 'error');
    window.setTimeout(() => {
      setCopyStatus((prev) => (prev === 'copied' ? 'idle' : prev));
    }, 2200);
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-slate-900 flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap truncate">
              모임 더치페이 정산기
            </span>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>초기화</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            차수별 모임 더치페이 정산
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-slate-500">
            1차, 2차, 3차 등 차수마다 결제 금액과 인원을 입력하면 차수별 1인당 금액과 단톡방 공지를
            한 번에 만들어 드립니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Dynamic Round Cards + Rounding Options + Calculate CTA */}
          <form
            onSubmit={handleCalculate}
            noValidate
            className="lg:col-span-6 space-y-4"
            aria-label="차수별 정산 입력"
          >
            {/* Dynamic Round Cards */}
            {rounds.map((round, index) => {
              const roundNumber = index + 1;
              const hasError = errorRoundIds.includes(round.id);

              return (
                <section
                  key={round.id}
                  aria-label={`${roundNumber}차 결제 정보`}
                  className={`bg-white rounded-2xl border shadow-[0_2px_16px_rgba(15,23,42,0.04)] p-5 sm:p-6 transition-colors ${
                    hasError ? 'border-rose-300' : 'border-slate-200/80'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        {roundNumber}차
                      </h2>
                      <span className="text-xs text-slate-400">결제 내역</span>
                    </div>

                    {rounds.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRound(round.id)}
                        aria-label={`${roundNumber}차 삭제`}
                        className="inline-flex items-center gap-1 min-h-[40px] px-2.5 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>삭제</span>
                      </button>
                    )}
                  </div>

                  <div className="mt-4 space-y-5">
                    {/* Round Amount Input */}
                    <div>
                      <label
                        htmlFor={`amount-${round.id}`}
                        className="block text-sm font-semibold text-slate-800 mb-2"
                      >
                        결제 금액
                      </label>
                      <div className="relative flex items-center">
                        <input
                          id={`amount-${round.id}`}
                          type="text"
                          inputMode="numeric"
                          placeholder="예: 120,000"
                          value={round.amountInput}
                          onChange={(e) => handleAmountChange(round.id, e.target.value)}
                          aria-invalid={hasError}
                          className={`w-full h-13 pl-4 pr-11 bg-slate-50 border rounded-xl text-right text-xl sm:text-2xl font-bold text-slate-900 tabular-nums placeholder:text-slate-300 placeholder:font-medium placeholder:text-base focus:outline-none focus:bg-white focus:ring-2 transition-colors ${
                            hasError
                              ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                              : 'border-slate-200 focus:border-blue-600 focus:ring-blue-600/15'
                          }`}
                        />
                        <span className="absolute right-4 text-sm sm:text-base font-semibold text-slate-500 pointer-events-none">
                          원
                        </span>
                      </div>

                      {/* Quick Add Buttons */}
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {QUICK_ADD_AMOUNTS.map((item) => (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => handleQuickAddAmount(round.id, item.value)}
                            className="min-h-[38px] px-2 text-xs font-medium text-slate-600 bg-slate-100/85 hover:bg-slate-200/70 active:scale-[0.98] rounded-lg transition-all whitespace-nowrap cursor-pointer tabular-nums"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>

                      {hasError && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{roundNumber}차 결제 금액을 입력해 주세요.</span>
                        </p>
                      )}
                    </div>

                    {/* Per-Round Participant Count (Stepper + Direct Number Input + Quick Buttons) */}
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <label
                          htmlFor={`people-${round.id}`}
                          className="text-sm font-semibold text-slate-800"
                        >
                          참여 인원수
                        </label>

                        {/* Direct Stepper & Numeric Input */}
                        <div className="inline-flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                          <button
                            type="button"
                            aria-label={`${roundNumber}차 인원 1명 줄이기`}
                            onClick={() =>
                              handlePeopleCountChange(round.id, round.peopleCount - 1)
                            }
                            disabled={round.peopleCount <= 1}
                            className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-200/60 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
                          >
                            <Minus className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <div className="flex items-center px-1 bg-white border-x border-slate-200 h-10">
                            <input
                              id={`people-${round.id}`}
                              type="text"
                              inputMode="numeric"
                              value={round.peopleCount}
                              onChange={(e) => handlePeopleInputChange(round.id, e.target.value)}
                              aria-label={`${roundNumber}차 참여 인원 숫자 입력`}
                              className="w-9 text-center text-sm font-bold text-slate-900 tabular-nums focus:outline-none bg-transparent"
                            />
                            <span className="text-xs font-medium text-slate-500 pr-1">명</span>
                          </div>
                          <button
                            type="button"
                            aria-label={`${roundNumber}차 인원 1명 늘리기`}
                            onClick={() =>
                              handlePeopleCountChange(round.id, round.peopleCount + 1)
                            }
                            disabled={round.peopleCount >= 99}
                            className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-200/60 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
                          >
                            <Plus className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      {/* Quick Preset Buttons */}
                      <div
                        role="group"
                        aria-label={`${roundNumber}차 인원 빠른 선택`}
                        className="grid grid-cols-5 gap-2"
                      >
                        {PRESET_PEOPLE.map((count) => {
                          const active = round.peopleCount === count;
                          return (
                            <button
                              key={count}
                              type="button"
                              aria-pressed={active}
                              onClick={() => handlePeopleCountChange(round.id, count)}
                              className={`min-h-[42px] rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer tabular-nums ${
                                active
                                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                                  : 'bg-slate-50 text-slate-700 border border-slate-200/80 hover:bg-slate-100'
                              }`}
                            >
                              {count}명
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}

            {/* + 차수 추가 Button */}
            <button
              type="button"
              onClick={handleAddRound}
              className="w-full min-h-[48px] rounded-2xl border border-dashed border-blue-300 bg-blue-50/45 hover:bg-blue-50 text-blue-600 font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>차수 추가 ({rounds.length + 1}차)</span>
            </button>

            {/* Rounding Option + Calculate CTA Card */}
            <section
              aria-label="정산 옵션 및 실행"
              className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_16px_rgba(15,23,42,0.04)] p-5 sm:p-6 space-y-5"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="text-sm font-semibold text-slate-800">
                    100원 단위 올림 여부
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {rounds.length}개 차수 · 합계 {formatKRW(liveTotalAmount)}원
                  </span>
                </div>

                <div
                  role="group"
                  aria-label="100원 단위 올림 여부"
                  className="grid grid-cols-2 gap-2.5"
                >
                  <button
                    type="button"
                    aria-pressed={roundingOption === 'round-up-100'}
                    onClick={() => setRoundingOption('round-up-100')}
                    className={`min-h-[60px] px-3.5 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                      roundingOption === 'round-up-100'
                        ? 'bg-blue-50/70 border-blue-600 text-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-semibold whitespace-nowrap ${
                          roundingOption === 'round-up-100' ? 'text-blue-700' : 'text-slate-900'
                        }`}
                      >
                        깔끔하게 올림
                      </span>
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          roundingOption === 'round-up-100'
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-slate-300'
                        }`}
                        aria-hidden="true"
                      >
                        {roundingOption === 'round-up-100' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">100원 단위로 깔끔하게</p>
                  </button>

                  <button
                    type="button"
                    aria-pressed={roundingOption === 'exact'}
                    onClick={() => setRoundingOption('exact')}
                    className={`min-h-[60px] px-3.5 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                      roundingOption === 'exact'
                        ? 'bg-blue-50/70 border-blue-600 text-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-semibold whitespace-nowrap ${
                          roundingOption === 'exact' ? 'text-blue-700' : 'text-slate-900'
                        }`}
                      >
                        정확히 나누기
                      </span>
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          roundingOption === 'exact'
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-slate-300'
                        }`}
                        aria-hidden="true"
                      >
                        {roundingOption === 'exact' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">1원 단위까지 정확하게</p>
                  </button>
                </div>
              </div>

              {validationMessage && (
                <p
                  role="alert"
                  className="flex items-center gap-1.5 text-xs font-medium text-rose-600"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{validationMessage}</span>
                </p>
              )}

              <button
                type="submit"
                className="w-full min-h-[52px] rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold text-base shadow-sm shadow-blue-600/20 transition-all cursor-pointer"
              >
                정산하기
              </button>
            </section>
          </form>

          {/* Right Column: Results & Notice Card */}
          <section
            ref={resultSectionRef}
            aria-label="정산 결과 및 단톡방 공지"
            className="lg:col-span-6 lg:sticky lg:top-22 bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_16px_rgba(15,23,42,0.04)] p-5 sm:p-7"
          >
            {!result ? (
              <div className="py-10 sm:py-14 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                  <Users className="w-7 h-7 text-blue-600" aria-hidden="true" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  차수별 정산 결과가 여기에 표시됩니다
                </h2>
                <p className="mt-2 text-sm text-slate-500 max-w-sm leading-relaxed">
                  왼쪽에서 차수별 금액과 참여 인원수를 입력하고 필요하면{' '}
                  <strong className="font-semibold text-slate-700">+ 차수 추가</strong>로 2차,
                  3차까지 추가한 뒤{' '}
                  <strong className="font-semibold text-slate-700">정산하기</strong>를 눌러주세요.
                </p>

                <div className="mt-6 pt-6 border-t border-slate-100 w-full flex flex-col items-center">
                  <button
                    type="button"
                    onClick={handleApplyExample}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-sm font-medium text-slate-700 transition-colors cursor-pointer"
                  >
                    예시로 계산해 보기 (1차 12만원·4명 / 2차 7.5만원·3명)
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary Hero Box */}
                <div className="rounded-xl bg-blue-50/75 border border-blue-100 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-blue-700/85">
                    <span>총 {result.rounds.length}개 차수</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {result.roundingOption === 'round-up-100'
                        ? '100원 단위 올림'
                        : '정확히 나누기'}
                    </span>
                  </div>

                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    {result.rounds.length === 1
                      ? '1인당 보낼 금액'
                      : '전 차수 모두 참석 시 1인당 합계'}
                  </p>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-blue-600 tabular-nums">
                      {formatKRW(result.totalPerPersonAllRounds)}
                    </span>
                    <span className="text-2xl sm:text-3xl font-bold text-blue-600">원</span>
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-blue-200/60 flex items-center justify-between gap-4 text-sm">
                    <span className="text-slate-600 font-medium">전체 합산 결제 금액</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {formatKRW(result.totalAmount)}원
                    </span>
                  </div>

                  {isStale && (
                    <p className="mt-3 pt-3 border-t border-blue-200/60 text-xs font-medium text-amber-700">
                      입력 조건이 변경되었습니다. 다시 &lsquo;정산하기&rsquo;를 눌러 결과를
                      업데이트하세요.
                    </p>
                  )}
                </div>

                {/* Per-Round Breakdown List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-bold text-slate-900">차수별 1인당 금액</h2>
                    {result.totalSurplus > 0 && (
                      <span className="text-xs font-medium text-blue-600 tabular-nums">
                        총 모금액 {formatKRW(result.totalCollected)}원 (+
                        {formatKRW(result.totalSurplus)}원)
                      </span>
                    )}
                  </div>

                  <ul className="divide-y divide-slate-100">
                    {result.rounds.map((r) => (
                      <li
                        key={r.id}
                        className="py-3 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">
                              {r.roundNumber}차
                            </span>
                            <span className="text-xs text-slate-500 tabular-nums">
                              {formatKRW(r.amount)}원 · {r.peopleCount}명
                            </span>
                          </div>
                          {r.surplusAmount > 0 && (
                            <p className="mt-0.5 text-xs text-slate-400 tabular-nums">
                              모금액 {formatKRW(r.collectedAmount)}원 (차액 +
                              {formatKRW(r.surplusAmount)}원)
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-base sm:text-lg font-bold text-slate-900 tabular-nums">
                            {formatKRW(r.perPersonAmount)}원
                          </span>
                          <span className="block text-[11px] text-slate-400">1인당</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Group Chat Notice Section */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900">단톡방 정산 공지 멘트</h2>
                    <span className="text-xs text-slate-400">카카오톡 · 문자 바로 붙여넣기</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      aria-label="모임명 (선택)"
                      placeholder="모임명 입력 (선택)"
                      value={gatheringName}
                      onChange={(e) => setGatheringName(e.target.value)}
                      maxLength={30}
                      className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 transition-colors"
                    />
                    <input
                      type="text"
                      aria-label="입금 계좌 (선택)"
                      placeholder="입금 계좌 입력 (선택)"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      maxLength={50}
                      className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 transition-colors"
                    />
                  </div>

                  <div
                    aria-label="생성된 정산 공지 내용"
                    className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 text-[13px] sm:text-sm leading-relaxed text-slate-800 whitespace-pre-wrap break-keep tabular-nums"
                  >
                    {noticeText}
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyNotice}
                    className={`w-full min-h-[48px] rounded-xl font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer ${
                      copyStatus === 'copied'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    {copyStatus === 'copied' ? (
                      <>
                        <Check className="w-4 h-4" aria-hidden="true" />
                        <span>공지 복사 완료! 단톡방에 붙여넣으세요</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" aria-hidden="true" />
                        <span>공지 복사하기</span>
                      </>
                    )}
                  </button>

                  {copyStatus === 'error' && (
                    <p role="alert" className="text-xs text-rose-600 text-center">
                      자동 복사가 제한되었습니다. 위 공지 텍스트를 길게 눌러 직접 복사해 주세요.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
