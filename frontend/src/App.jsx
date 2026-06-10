import React, { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  Home, 
  Coins, 
  Utensils, 
  RefreshCw, 
  HelpCircle,
  Sparkles,
  ArrowRightLeft,
  Share2,
  Copy,
  Download,
  Check,
  Car
} from 'lucide-react'
import html2canvas from 'html2canvas'

// 카카오 Javascript 앱 키 (Vite 환경 변수 연동, 미등록 시 가상 키 활용 폴백 작동)
const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY || 'YOUR_KAKAO_JS_KEY'
const DONATION_INFO = import.meta.env.VITE_DONATION_INFO || '카카오뱅크 3333-01-2345678 (예시)'
const SPONSOR_CONTACT = import.meta.env.VITE_SPONSOR_CONTACT || 'yongwook.ahn@gmail.com'

function App() {
  const [mesoInput, setMesoInput] = useState('100000000') // 기본 1억 메소
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [showTooltip, setShowTooltip] = useState(false)
  
  // 부동산 3종 세트 탭 상태관리 (seoul, gyeonggi, gumi)
  const [activeAptTab, setActiveAptTab] = useState('gumi')
  
  // 자동차 3종 세트 탭 상태관리 (avante, g80, ferrari)
  const [activeCarTab, setActiveCarTab] = useState('avante')
  
  // 게임 버전 선택 상태관리 ('mapleland' | 'live')
  const [gameType, setGameType] = useState('mapleland')
  
  // 바이럴 공유 상태관리
  const [copied, setCopied] = useState(false)
  const [communityCopied, setCommunityCopied] = useState(false)
  const [donationCopied, setDonationCopied] = useState(false)
  const [kakaoShared, setKakaoShared] = useState(false)
  const [savingReceipt, setSavingReceipt] = useState(false)
  const [kakaoCopiedText, setKakaoCopiedText] = useState('')

  // 카카오 SDK 초기화
  useEffect(() => {
    if (window.Kakao && !window.Kakao.isInitialized()) {
      try {
        window.Kakao.init(KAKAO_JS_KEY)
      } catch (err) {
        console.warn('카카오 SDK 초기화 스킵 (가상 자바스크립트 키 사용중):', err)
      }
    }
  }, [])

  // 자산 계산 실행 함수
  const handleCalculate = async (valueToSubmit, forceGameType) => {
    setLoading(true)
    setError(null)
    
    const targetMeso = valueToSubmit || mesoInput
    const targetGameType = forceGameType || gameType
    
    try {
      let response;
      try {
        response = await fetch(`/api/exchange?meso=${targetMeso}&game_type=${targetGameType}`)
      } catch (proxyErr) {
        console.warn('Vite 프록시 연결 실패, 백엔드 절대 경로로 재시도합니다.', proxyErr)
        response = await fetch(`http://localhost:8000/api/exchange?meso=${targetMeso}&game_type=${targetGameType}`)
      }

      if (!response.ok) {
        throw new Error('API 응답에 오류가 발생했습니다.')
      }
      
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError('백엔드 서버와 통신할 수 없습니다. FastAPI 서버가 켜져 있는지 확인해 주세요.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // 게임 타입 변경 핸들러
  const handleGameTypeChange = (type) => {
    setGameType(type)
    handleCalculate(null, type)
  }

  // 초기 로드 시 실행
  useEffect(() => {
    handleCalculate('100000000', 'mapleland')
  }, [])

  // 메소 입력 포맷팅
  const handleInputChange = (e) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '')
    setMesoInput(rawValue)
  }

  // 빠른 추가 버튼 핸들러
  const handleAddMeso = (amount) => {
    const current = parseInt(mesoInput || '0', 10)
    const nextValue = Math.max(0, current + amount).toString()
    setMesoInput(nextValue)
  }

  const handleClear = () => {
    setMesoInput('0')
    setResult(null)
  }

  // 한글 금액 변환 포맷팅 함수 (예: 10,000,000 -> 1,000만, 조/경 단위 지원)
  const formatMesoKorean = (numStr) => {
    try {
      const cleaned = numStr ? numStr.toString().replace(/[^0-9]/g, '') : ''
      const num = BigInt(cleaned || '0')
      if (num === 0n) return '0 메소'
      
      const gyeong = num / 10000000000000000n
      const jo = (num % 10000000000000000n) / 1000000000000n
      const eok = (num % 1000000000000n) / 100000000n
      const man = (num % 100000000n) / 10000n
      
      let resultStr = ''
      if (gyeong > 0n) resultStr += `${gyeong}경 `
      if (jo > 0n) resultStr += `${jo}조 `
      if (eok > 0n) resultStr += `${eok}억 `
      if (man > 0n) resultStr += `${man}만 `
      
      return resultStr.trim() + ' 메소'
    } catch (err) {
      return '0 메소'
    }
  }

  // 만 원 단위 변환 포맷터 (조/억/만 단위 지원)
  const formatKrwKorean = (krw) => {
    try {
      const num = BigInt(krw ? krw.toString().replace(/[^0-9]/g, '') : '0')
      if (num === 0n) return '0원'
      
      const jo = num / 1000000000000n
      const eok = (num % 1000000000000n) / 100000000n
      const man = (num % 100000000n) / 10000n
      
      let result = ''
      if (jo > 0n) result += `${jo}조 `
      if (eok > 0n) result += `${eok}억 `
      if (man > 0n) result += `${man}만 `
      return result.trim() + ' 원'
    } catch (err) {
      return '0원'
    }
  }

  // 시가총액 조/억 원 포맷터 (신설)
  const formatMarketCap = (marketCap) => {
    const jo = Math.floor(marketCap / 1000000000000)
    const eok = Math.floor((marketCap % 1000000000000) / 100000000)
    
    let result = ''
    if (jo > 0) result += `${jo}조 `
    if (eok > 0) result += `${eok.toLocaleString()}억 `
    return result.trim() + ' 원'
  }

  // 아파트 평수 시뮬레이터 렌더러
  const renderApartmentVisual = (pyeong, tabKey) => {
    if (!pyeong) return null;
    
    let scaleMultiplier = 15;
    if (tabKey === 'seoul') scaleMultiplier = 120;
    else if (tabKey === 'gyeonggi') scaleMultiplier = 35;
    else scaleMultiplier = 15;
    
    let scale = Math.min(100, Math.max(6, pyeong * scaleMultiplier))
    
    let items = []
    if (pyeong >= 20 / (scaleMultiplier / 10)) {
      items = ['🚪 현관', '🛁 욕실', '🛏️ 작은방', '🛏️ 안방', '🛋️ 거실', '🍳 주방']
    } else if (pyeong >= 8 / (scaleMultiplier / 10)) {
      items = ['🚪 현관', '🛁 욕실', '🛏️ 안방']
    } else if (pyeong >= 3 / (scaleMultiplier / 10)) {
      items = ['🚪 현관', '🛁 욕실']
    } else if (pyeong >= 1 / (scaleMultiplier / 10)) {
      items = ['🚪 신발장']
    } else {
      items = ['🧼 바닥 타일']
    }

    return (
      <div className="mt-4 p-3 rounded-xl border border-slate-850 bg-slate-950/40 flex flex-col items-center justify-center">
        <span className="text-[10px] text-slate-500 mb-2 font-medium">단지 내 소유 면적 시각화</span>
        
        <div className="relative w-full h-28 bg-slate-950/90 rounded-lg border border-dashed border-slate-800 flex items-center justify-center overflow-hidden">
          <div 
            className="rounded-lg border-2 border-maple-500 bg-maple-500/10 flex flex-wrap gap-0.5 p-1 items-center justify-center transition-all duration-500 ease-out"
            style={{ width: `${scale}%`, height: `${scale}%`, minWidth: '20px', minHeight: '20px' }}
          >
            {items.map((item, idx) => (
              <span key={idx} className="text-[8px] px-1 py-0.2 bg-slate-900/90 text-maple-400 rounded border border-maple-500/20 whitespace-nowrap">
                {item}
              </span>
            ))}
          </div>
          {pyeong * scaleMultiplier < 0.8 && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/95">
              <span className="text-[9px] text-orange-400 animate-pulse text-center px-4">
                🔬 현미경 필요: 너무 미세해서 형체가 보이지 않습니다.
              </span>
            </div>
          )}
        </div>
        
        <div className="w-full flex justify-between text-[8px] text-slate-600 mt-1.5">
          <span>0평</span>
          <span>내 소유 면적 비율 ({scale.toFixed(1)}%)</span>
        </div>
      </div>
    )
  }

  // 자동차 완차 출고 시뮬레이터 렌더러
  const renderCarVisual = (qty) => {
    const progress = Math.min(100, qty * 100)
    
    return (
      <div className="mt-4 p-3 rounded-xl border border-slate-850 bg-slate-950/40 flex flex-col justify-center space-y-2">
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>완차 조립 완성도</span>
          <span className="font-semibold text-maple-400">{progress.toFixed(2)}%</span>
        </div>
        
        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
          <div 
            className="h-full bg-gradient-to-r from-maple-600 to-orange-400 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-[8px] text-slate-600">
          <span>볼트 쪼개기</span>
          <span>완차 1대 출고 ({qty >= 1 ? `완차 ${Math.floor(qty)}대 + 조립중` : '가설 조립'})</span>
        </div>
      </div>
    )
  }

  // 자산 영수증 이미지 저장 (html2canvas)
  const handleDownloadReceipt = async () => {
    const element = document.getElementById('receipt-panel')
    if (!element) return
    
    setSavingReceipt(true)
    
    try {
      const canvas = await html2canvas(element, {
        useCORS: true,
        backgroundColor: '#0b0f19',
        scale: 2,
        logging: false,
        onclone: (clonedDocument) => {
          const btn = clonedDocument.getElementById('receipt-actions')
          if (btn) btn.style.display = 'none'
        }
      })
      
      const image = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = image
      link.download = `maple-exchange-receipt-${result.meso}meso.png`
      link.click()
    } catch (err) {
      console.error('영수증 다운로드 실패', err)
      alert('영수증 이미지 저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setSavingReceipt(false)
    }
  }

  // 링크 복사
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 카카오 공유 메시지 템플릿
  const getShareMessage = (data, aptTab, carTab) => {
    const userName = "방구석 모험가"
    const aptName = data.apartments[aptTab].name
    const aptComment = data.apartments[aptTab].comment
    const carName = data.cars[carTab].name
    const carComment = data.cars[carTab].comment
    const tierName = data.tier_name
    
    const templates = [
      {
        title: `[📢 빅토리아 아일랜드 긴급 속보]`,
        description: `메소 환전소 충격 보고! ${userName}님이 보유 메소를 현실 금융 시장에 환전한 결과, [${aptComment} / ${carComment}]에 성공했습니다! 방구석 자산 등급: [${tierName}]`
      },
      {
        title: `[🚨 대박 사건 목격!]`,
        description: `메이플랜드 광업으로 무려 [${carName}] 부품과 [${aptName}] 등기를 지배하는 신흥 자산가 등장! 방구석 자산 등급: [${tierName}]`
      },
      {
        title: `[🚗 본격 현실 등기 및 출고 인증]`,
        description: `피땀 깃든 메소 환전 완료! ${carComment}에 도달하고 내 땅 내 집 마련에 성공했습니다. 당신의 자산 등급은?`
      },
      {
        title: `[🔥 메이플랜드 만수르 강림]`,
        description: `이재용 회장님도 뒷걸음질 칠 메이플 황제 등장! ${aptComment}을 달성하고 호화 라이프 조립 중!`
      }
    ]
    
    const randomIndex = Math.floor(Math.random() * templates.length)
    return templates[randomIndex]
  }

  // 카카오톡 공유 피드 API 연동 및 폴백 처리
  const handleKakaoShare = () => {
    if (!result) return
    
    const msg = getShareMessage(result, activeAptTab, activeCarTab)
    const pageUrl = window.location.origin + window.location.pathname
    const imageUrl = 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=60'
    
    if (window.Kakao && window.Kakao.isInitialized()) {
      try {
        window.Kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title: msg.title,
            description: msg.description,
            imageUrl: imageUrl,
            link: {
              mobileWebUrl: pageUrl,
              webUrl: pageUrl,
            },
          },
          buttons: [
            {
              title: '나도 메소 환전해보기',
              link: {
                mobileWebUrl: pageUrl,
                webUrl: pageUrl,
              },
            },
            {
              title: '이 사람의 영수증 보기',
              link: {
                mobileWebUrl: pageUrl,
                webUrl: pageUrl,
              },
            }
          ]
        })
        return
      } catch (err) {
        console.warn('Kakao.Share API 호출 실패, 폴백 복사로 전환:', err)
      }
    }
    
    const viralText = `${msg.title}\n\n${msg.description}\n\n👉 나도 방구석 자산 환전하러 가기: ${pageUrl}`
    navigator.clipboard.writeText(viralText)
    
    setKakaoCopiedText(viralText)
    setKakaoShared(true)
    setTimeout(() => {
      setKakaoShared(false)
      setKakaoCopiedText('')
    }, 4500)
  }

  // 커뮤니티(디시, 아카, 인벤) 자랑용 템플릿 복사
  const handleCopyCommunityText = () => {
    if (!result) return
    
    const pageUrl = window.location.origin + window.location.pathname
    const formatNumber = (num) => Math.floor(num).toLocaleString()
    
    const aptDetail = result.apartments[activeAptTab]
    const carDetail = result.cars[activeCarTab]
    
    const text = `🍁 방구석 자산 환전소 영수증 인증 (${gameType === 'live' ? '메이플 본섭' : '메이플랜드'}) 🍁

💰 보유 메소: ${formatMesoKorean(result.meso)}
💵 현실 원화 환산 가치: ₩${result.krw.toLocaleString()}원
🎖️ 방구석 자산 등급: [${result.tier_name}]

🏢 부동산 (${aptDetail.name}):
👉 소유 면적: ${aptDetail.pyeong}평 (${aptDetail.m2}㎡)
👉 상태: ${aptDetail.comment}

🚗 자동차 (${carDetail.name}):
👉 획득 상태: ${carDetail.qty}대 분량
👉 상태: ${carDetail.comment}

🍜 보너스: 평생 짜장면 ${formatNumber(result.jajangmyeon_qty)}그릇 시식 가능!
👉 나도 메란다 쌀먹하러 가기: ${pageUrl}`

    navigator.clipboard.writeText(text)
    setCommunityCopied(true)
    setTimeout(() => setCommunityCopied(false), 2000)
  }

  // 후원 계좌 복사
  const handleCopyDonation = () => {
    navigator.clipboard.writeText(DONATION_INFO)
    setDonationCopied(true)
    setTimeout(() => setDonationCopied(false), 2000)
  }

  return (
    <div className="relative min-h-screen grid-overlay flex flex-col justify-between">
      
      {/* 백그라운드 네온 빛 효과 */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 md:w-96 h-72 md:h-96 bg-maple-500/10 rounded-full blur-[100px] md:blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-72 md:w-96 h-72 md:h-96 bg-purple-500/10 rounded-full blur-[100px] md:blur-[120px] pointer-events-none"></div>

      {/* 헤더 */}
      <header className="w-full py-4 md:py-6 px-4 md:px-8 border-b border-slate-800 bg-slate-950/30 backdrop-blur-md z-10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2 md:space-x-3">
            <span className="text-2xl md:text-3xl leaf-float-animation">🍁</span>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-maple-400 via-orange-400 to-amber-300 bg-clip-text text-transparent">
                방구석 자산 환전소
              </h1>
              <p className="text-[8px] md:text-xs text-slate-400">Mapleland Live Financial Converter</p>
            </div>
          </div>
          
          <div>
            <span className="text-[10px] md:text-xs px-2 md:px-2.5 py-1 bg-slate-850 text-slate-300 rounded-full border border-slate-700 flex items-center gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              API 실시간 갱신 중
            </span>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="flex-grow max-w-4xl w-full mx-auto px-4 py-6 md:py-8 z-10 space-y-6 md:space-y-8">
        
        {/* 오프닝 타이틀 */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight leading-snug">
            내 메소는 <span className="text-maple-400 underline decoration-wavy decoration-orange-500 underline-offset-4">진짜 금융 시장</span>에서 얼마일까?
          </h2>
          <p className="text-xs md:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
            실시간 주식/코인의 '국내 시가총액 TOP 3' 랭킹 파이프라인과 국토부 실거래 부동산을 결합한 핀테크 환전소입니다.
          </p>
        </div>

        {/* 게임 종류 선택 탭 (Segmented Control) */}
        <div className="max-w-xs mx-auto p-1 rounded-xl bg-slate-950 border border-slate-850 flex relative">
          <button
            onClick={() => handleGameTypeChange('mapleland')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all z-10 flex items-center justify-center gap-1.5 ${
              gameType === 'mapleland' ? 'text-white bg-maple-600/90 shadow' : 'text-slate-450 hover:text-slate-200'
            }`}
          >
            🍁 메이플랜드
          </button>
          <button
            onClick={() => handleGameTypeChange('live')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all z-10 flex items-center justify-center gap-1.5 ${
              gameType === 'live' ? 'text-white bg-orange-600/90 shadow' : 'text-slate-450 hover:text-slate-200'
            }`}
          >
            🌟 메이플 본섭
          </button>
        </div>

        {/* 입력 카드 */}
        <div className="glass-panel rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-2xl glow-card">
          
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs md:text-sm font-semibold text-slate-300 flex items-center gap-1">
              보유 중인 메소(Meso) 금액 입력
              <button 
                onClick={() => setShowTooltip(!showTooltip)} 
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <HelpCircle size={14} />
              </button>
            </label>
            
            <span className="text-xs text-maple-400 font-mono font-semibold">
              {formatMesoKorean(mesoInput)}
            </span>
          </div>

          {/* 시세 안내 툴팁 */}
          {showTooltip && (
            <div className="mb-4 p-3.5 rounded-xl bg-orange-950/30 border border-maple-500/20 text-[10px] md:text-xs text-orange-200 space-y-1 leading-relaxed">
              {gameType === 'live' ? (
                <>
                  <p>📌 <strong>환율 기준:</strong> 1억 메소 = 2,200원 고정 매핑</p>
                  <p>🔥 <strong>국대 주식 TOP 3:</strong> 네이버 금융 코스피 시가총액 상위 3사 실시간 크롤링 연동</p>
                  <p>🐋 <strong>글로벌 코인 TOP 3:</strong> 글로벌 CoinGecko 암호화폐 시가총액 상위 3사 및 업비트 실가격 매핑</p>
                  <p>🏢 <strong>부동산/자동차:</strong> 국토부 실거래 총액 및 최근 대표 시세 기준</p>
                </>
              ) : (
                <>
                  <p>📌 <strong>환율 기준:</strong> 1,000만 메소 = 1,800원 고정 매핑</p>
                  <p>🔥 <strong>국대 주식 TOP 3:</strong> 네이버 금융 코스피 시가총액 상위 3사 실시간 크롤링 연동</p>
                  <p>🐋 <strong>글로벌 코인 TOP 3:</strong> 글로벌 CoinGecko 암호화폐 시가총액 상위 3사 및 업비트 실가격 매핑</p>
                  <p>🏢 <strong>부동산/자동차:</strong> 국토부 실거래 총액 및 최근 대표 시세 기준</p>
                </>
              )}
            </div>
          )}

          {/* 입력 필드 & 슬라이더 */}
          <div className="space-y-4">
            <div className="relative flex items-center">
              <input
                type="text"
                value={parseInt(mesoInput || '0', 10).toLocaleString()}
                onChange={handleInputChange}
                className="glass-input w-full px-4 py-3 md:py-4 rounded-xl md:rounded-2xl text-xl md:text-2xl font-bold font-mono tracking-wide pr-16"
                placeholder="0"
              />
              <span className="absolute right-4 font-bold text-xs md:text-sm text-slate-400">MESO</span>
            </div>

            {/* 빠른 입력 단추 */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              {gameType === 'live' ? (
                <>
                  <button
                    onClick={() => handleAddMeso(100000000)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg border border-slate-700 transition-colors"
                  >
                    +1억
                  </button>
                  <button
                    onClick={() => handleAddMeso(1000000000)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg border border-slate-700 transition-colors"
                  >
                    +10억
                  </button>
                  <button
                    onClick={() => handleAddMeso(10000000000)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg border border-slate-700 transition-colors"
                  >
                    +100억
                  </button>
                  <button
                    onClick={() => handleAddMeso(-1000000000)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-red-950/30 text-slate-400 rounded-lg border border-slate-700 transition-colors"
                  >
                    -10억
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleAddMeso(10000000)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg border border-slate-700 transition-colors"
                  >
                    +1,000만
                  </button>
                  <button
                    onClick={() => handleAddMeso(100000000)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg border border-slate-700 transition-colors"
                  >
                    +1억
                  </button>
                  <button
                    onClick={() => handleAddMeso(1000000000)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg border border-slate-700 transition-colors"
                  >
                    +10억
                  </button>
                  <button
                    onClick={() => handleAddMeso(-100000000)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-red-950/30 text-slate-400 rounded-lg border border-slate-700 transition-colors"
                  >
                    -1억
                  </button>
                </>
              )}
              <button
                onClick={handleClear}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 text-slate-500 rounded-lg border border-slate-800 ml-auto transition-colors"
              >
                초기화
              </button>
            </div>

            {/* 계산 실행 버튼 */}
            <button
              onClick={() => handleCalculate()}
              disabled={loading}
              className="w-full py-3 md:py-4 bg-gradient-to-r from-maple-600 via-maple-500 to-orange-500 hover:from-maple-500 hover:to-orange-400 text-white font-bold rounded-xl md:rounded-2xl transition-all shadow-lg shadow-maple-500/15 active:scale-98 flex items-center justify-center gap-1.5 text-base md:text-lg disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={18} />
                  금융 시장 통신 중...
                </>
              ) : (
                <>
                  <ArrowRightLeft size={18} />
                  실시간 현실 자산 환전하기
                </>
              )}
            </button>
          </div>
        </div>

        {/* 상단 슬림 네온 광고 배너 (수익화 1) */}
        <div className="w-full py-3.5 px-4 rounded-xl border border-slate-800 bg-slate-950/60 backdrop-blur-sm flex flex-col sm:flex-row justify-between items-center gap-3 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-maple-500 to-orange-500"></div>
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded font-semibold tracking-wider">SPONSOR</span>
            <div className="text-[11px] text-slate-300 font-medium">
              🍁 <span className="text-maple-400 font-bold">이 자리에 광고를 달고 쌀먹하세요!</span> (트래픽 광고 구좌 대여 중)
            </div>
          </div>
          <a 
            href={SPONSOR_CONTACT.startsWith('http') ? SPONSOR_CONTACT : `mailto:${SPONSOR_CONTACT}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-[10px] text-slate-400 hover:text-white transition-colors border border-slate-700 hover:border-slate-500 px-3 py-1 rounded bg-slate-900/40"
          >
            스폰서 문의하기 &rarr;
          </a>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs md:text-sm text-center">
            ⚠️ {error}
          </div>
        )}

        {/* 모바일/PC 카카오 가상 공유 성공 디아일로그 알림 */}
        {kakaoShared && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-355 text-xs md:text-sm text-center animate-bounce space-y-2 z-20">
            <p className="font-bold">✨ [카카오 공유 폴백 알림] 단톡방 공유 문구가 클립보드에 자동 복사되었습니다!</p>
            <div className="p-2.5 bg-slate-950/90 rounded border border-slate-800 text-[10px] text-slate-400 text-left font-mono whitespace-pre-line leading-relaxed max-w-md mx-auto">
              {kakaoCopiedText}
            </div>
            <p className="text-[10px] text-emerald-400 font-medium">카톡 단톡방이나 디스코드에 바로 [붙여넣기(Ctrl+V)] 하세요!</p>
          </div>
        )}

        {/* 결과 섹션 */}
        {result && (
          <div className="space-y-6">
            
            {/* 자산 영수증 이미지 캡처 대상 영역 */}
            <div id="receipt-panel" className="p-5 md:p-8 rounded-2xl md:rounded-3xl border border-slate-800 bg-[#0b0f19] space-y-6 shadow-2xl relative overflow-hidden">
              
              {/* 영수증 상단 바코드 데코레이션 */}
              <div className="flex flex-col items-center border-b border-dashed border-slate-800 pb-5">
                <span className="text-[10px] text-maple-400 font-mono tracking-widest font-bold font-sans">🍁 MAPLELAND FINANCIAL EXCHANGE 🍁</span>
                <div className="text-3xl font-black text-white tracking-widest my-1.5 font-sans">RECEIPT</div>
                <div className="w-48 h-8 opacity-50 my-1 bg-gradient-to-r from-transparent via-slate-400 to-transparent flex justify-center items-center text-[8px] tracking-[5px] text-slate-900 font-black">
                  ||||| | ||| || ||||| | ||
                </div>
                <span className="text-[8px] text-slate-500 font-mono">NO.{result.meso} - 2026.06.11</span>
              </div>

              {/* 총 가치 및 칭호 */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 p-4 md:p-5 rounded-xl border border-slate-800/80">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">현실 원화 환산 가치</span>
                  <div className="text-3xl md:text-4xl font-extrabold text-white mt-0.5 flex items-baseline gap-1">
                    <span className="text-xl text-slate-450 font-normal">₩</span>
                    {result.krw.toLocaleString()}
                    <span className="text-sm text-slate-450 font-normal">원</span>
                  </div>
                </div>

                <div className="border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-5 w-full md:w-auto">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="text-maple-400" size={14} />
                    <span className="text-xs md:text-sm font-bold text-maple-300">{result.tier_name}</span>
                  </div>
                  <p className="text-[10px] md:text-xs text-slate-455 leading-relaxed max-w-xs font-medium">
                    {result.tier_desc}
                  </p>
                </div>
              </div>

              {/* 상세 정보 반응형 그리드 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                
                {/* [주식] 실시간 국대 주식 TOP 3 카드 (시가총액 기준) */}
                <div className="p-4 rounded-xl md:rounded-2xl border border-slate-800 bg-slate-900/30 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded border border-blue-500/20">실시간 국대 주식 TOP 3</span>
                      <span className="text-[9px] text-slate-500 font-sans">코스피 시가총액순</span>
                    </div>

                    <h4 className="text-sm md:text-base font-bold text-white mt-3 flex items-center gap-1">
                      <TrendingUp size={16} className="text-blue-400" />
                      주식 시가총액 랭킹
                    </h4>
                    
                    <div className="mt-3.5 space-y-2.5">
                      {result.stocks.map((stock) => (
                        <div key={stock.rank} className="p-2.5 bg-slate-950/65 rounded-lg border border-slate-850 flex justify-between items-center gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-blue-400">{stock.rank}위</span>
                              <span className="text-xs font-bold text-white">{stock.name}</span>
                              {stock.tag && (
                                <span className="text-[8px] bg-red-650 text-white font-bold px-1 rounded-sm animate-pulse">
                                  {stock.tag}
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] text-slate-500 leading-relaxed">
                              시세: {stock.price.toLocaleString()}원 <br />
                              시총: {formatMarketCap(stock.market_cap)}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-400">매수 가능 수량</span>
                            <div className="text-xs font-extrabold text-blue-400 font-mono">
                              {stock.qty.toLocaleString()} <span className="text-[9px] font-normal text-slate-300">주</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* [코인] 실시간 국대 코인 TOP 3 카드 (시가총액 기준) */}
                <div className="p-4 rounded-xl md:rounded-2xl border border-slate-800 bg-slate-900/30 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-yellow-400 bg-yellow-900/20 px-2 py-0.5 rounded border border-yellow-500/20">실시간 글로벌 코인 TOP 3</span>
                      <span className="text-[9px] text-slate-500 font-sans">글로벌 시가총액순</span>
                    </div>

                    <h4 className="text-sm md:text-base font-bold text-white mt-3 flex items-center gap-1">
                      <Coins size={16} className="text-yellow-400" />
                      코인 시가총액 랭킹
                    </h4>
                    
                    <div className="mt-3.5 space-y-2.5">
                      {result.coins.map((coin) => (
                        <div key={coin.rank} className="p-2.5 bg-slate-950/65 rounded-lg border border-slate-850 flex justify-between items-center gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-yellow-400">{coin.rank}위</span>
                              <span className="text-xs font-bold text-white">{coin.name}</span>
                              <span className="text-[9px] text-slate-500 font-mono">({coin.symbol})</span>
                              {coin.tag && (
                                <span className="text-[8px] bg-yellow-650 text-slate-950 font-bold px-1 rounded-sm">
                                  {coin.tag}
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] text-slate-500 leading-relaxed">
                              시세: {coin.price.toLocaleString()}원 <br />
                              시총: {formatMarketCap(coin.market_cap)}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-400">스왑 가능 수량</span>
                            <div className="text-xs font-extrabold text-yellow-400 font-mono">
                              {coin.qty.toLocaleString()} <span className="text-[9px] font-normal text-slate-350">개</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 부동산 카드 */}
                <div className="p-4 rounded-xl md:rounded-2xl border border-slate-800 bg-slate-900/30 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-900/20 px-2 py-0.5 rounded border border-amber-500/20">국토부 실거래가 기준</span>
                      
                      <div className="flex bg-slate-950 p-0.5 rounded border border-slate-800 text-[8px] md:text-[9px]">
                        <button
                          onClick={() => setActiveAptTab('seoul')}
                          className={`px-1.5 py-0.5 rounded font-semibold transition-all ${
                            activeAptTab === 'seoul' ? 'bg-maple-500 text-white' : 'text-slate-450 hover:text-slate-200'
                          }`}
                        >
                          서울
                        </button>
                        <button
                          onClick={() => setActiveAptTab('gyeonggi')}
                          className={`px-1.5 py-0.5 rounded font-semibold transition-all ${
                            activeAptTab === 'gyeonggi' ? 'bg-maple-500 text-white' : 'text-slate-450 hover:text-slate-200'
                          }`}
                        >
                          수도권
                        </button>
                        <button
                          onClick={() => setActiveAptTab('gumi')}
                          className={`px-1.5 py-0.5 rounded font-semibold transition-all ${
                            activeAptTab === 'gumi' ? 'bg-maple-500 text-white' : 'text-slate-450 hover:text-slate-200'
                          }`}
                        >
                          구미
                        </button>
                      </div>
                    </div>

                    <h4 className="text-sm md:text-base font-bold text-white mt-3 flex items-center gap-1">
                      <Home size={16} className="text-amber-400" />
                      {result.apartments[activeAptTab].name}
                    </h4>

                    <div className="mt-2 text-[10px] text-slate-400 leading-relaxed bg-slate-950/50 p-2.5 rounded-lg border border-slate-850">
                      <div className="flex justify-between">
                        <span>실거래 매매가</span>
                        <span className="text-white font-semibold">{formatKrwKorean(result.apartments[activeAptTab].total_price)}</span>
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <span>기준 평형</span>
                        <span>{result.apartments[activeAptTab].pyeong_size}평형</span>
                      </div>
                    </div>

                    <div className="text-xl md:text-2xl font-extrabold text-amber-400 mt-2.5 font-mono">
                      {result.apartments[activeAptTab].pyeong} <span className="text-xs font-normal text-slate-350">평</span>
                      <span className="text-[10px] font-normal text-slate-550 ml-1.5">({result.apartments[activeAptTab].m2}㎡)</span>
                    </div>

                    <div className="mt-2.5 p-2 bg-amber-950/15 border border-amber-500/10 rounded-lg text-[10px] text-amber-200 leading-relaxed">
                      📢 {result.apartments[activeAptTab].comment}
                    </div>
                  </div>

                  {renderApartmentVisual(result.apartments[activeAptTab].pyeong, activeAptTab)}
                </div>

                {/* 자동차 카드 */}
                <div className="p-4 rounded-xl md:rounded-2xl border border-slate-800 bg-slate-900/30 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-500/20">현실 자동차 환산</span>
                      
                      <div className="flex bg-slate-950 p-0.5 rounded border border-slate-800 text-[8px] md:text-[9px]">
                        <button
                          onClick={() => setActiveCarTab('avante')}
                          className={`px-1.5 py-0.5 rounded font-semibold transition-all ${
                            activeCarTab === 'avante' ? 'bg-maple-500 text-white' : 'text-slate-450 hover:text-slate-200'
                          }`}
                        >
                          아반떼
                        </button>
                        <button
                          onClick={() => setActiveCarTab('g80')}
                          className={`px-1.5 py-0.5 rounded font-semibold transition-all ${
                            activeCarTab === 'g80' ? 'bg-maple-500 text-white' : 'text-slate-450 hover:text-slate-200'
                          }`}
                        >
                          제네시스
                        </button>
                        <button
                          onClick={() => setActiveCarTab('ferrari')}
                          className={`px-1.5 py-0.5 rounded font-semibold transition-all ${
                            activeCarTab === 'ferrari' ? 'bg-maple-500 text-white' : 'text-slate-450 hover:text-slate-200'
                          }`}
                        >
                          페라리
                        </button>
                      </div>
                    </div>

                    <h4 className="text-sm md:text-base font-bold text-white mt-3 flex items-center gap-1">
                      <Car size={16} className="text-emerald-400" />
                      {result.cars[activeCarTab].name}
                    </h4>

                    <div className="mt-2 text-[10px] text-slate-400 leading-relaxed bg-slate-950/50 p-2.5 rounded-lg border border-slate-850">
                      <div className="flex justify-between">
                        <span>기준 신차가</span>
                        <span className="text-white font-semibold">{formatKrwKorean(result.cars[activeCarTab].price)}</span>
                      </div>
                    </div>

                    <div className="text-xl md:text-2xl font-extrabold text-emerald-400 mt-2.5 font-mono">
                      {result.cars[activeCarTab].qty} <span className="text-xs font-normal text-slate-355">대</span>
                    </div>

                    <div className="mt-2.5 p-2 bg-emerald-950/15 border border-emerald-500/10 rounded-lg text-[10px] text-emerald-200 leading-relaxed">
                      📢 {result.cars[activeCarTab].comment}
                    </div>
                  </div>

                  {renderCarVisual(result.cars[activeCarTab].qty)}
                </div>

              </div>

              {/* 생활형 식음료 한줄 요약 데코레이션 */}
              <div className="p-3 bg-red-950/10 border border-red-500/10 rounded-xl text-center text-[10px] text-red-300">
                🍜 <strong>뽀나스 환산:</strong> 하루 세끼 짜장면만 조진다면 약 <strong>{result.jajangmyeon_qty.toLocaleString()} 그릇</strong>으로 <strong>{Math.floor(result.jajangmyeon_qty / 3).toLocaleString()}일</strong> 동안 생존 연명 가능!
              </div>

              {/* 영수증 하단 */}
              <div className="border-t border-dashed border-slate-800 pt-4 text-center">
                <span className="text-[9px] text-slate-550 font-mono tracking-wider font-sans">THANK YOU FOR PLAYING!</span>
              </div>
            </div>

            {/* 영수증 외부 액션 버튼 영역 */}
            <div id="receipt-actions" className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDownloadReceipt}
                disabled={savingReceipt}
                className="flex-1 py-3 bg-slate-850 hover:bg-slate-750 text-white border border-slate-700 font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
              >
                {savingReceipt ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    영수증 생성 중...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    내 메란다 영수증 저장 (.PNG)
                  </>
                )}
              </button>
              
              <button
                onClick={handleCopyLink}
                className="py-3 px-4 bg-slate-900 hover:bg-slate-850 text-slate-350 border border-slate-800 font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
              >
                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                {copied ? '링크가 복사되었습니다!' : '결과 링크 복사'}
              </button>

              <button
                onClick={handleKakaoShare}
                className="py-3 px-4 bg-yellow-500 hover:bg-yellow-450 text-slate-950 font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
              >
                <Share2 size={16} />
                카카오톡 공유
              </button>

              <button
                onClick={handleCopyCommunityText}
                className="py-3 px-4 bg-blue-650 hover:bg-blue-500 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
              >
                {communityCopied ? <Check size={16} /> : <Share2 size={16} />}
                {communityCopied ? '복사 완료!' : '디시/아카 자랑용 복사'}
              </button>
            </div>

            {/* 후원 컴포넌트 */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/10 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl md:text-3xl">☕</span>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    개발자 물약값(커피) 후원하기
                    <span className="text-[9px] bg-maple-500/10 text-maple-400 border border-maple-500/20 px-1.5 py-0.2 rounded">쌀먹 지원</span>
                  </h4>
                  <p className="text-[10px] md:text-xs text-slate-450 mt-1 leading-relaxed">
                    재미있게 사용하셨나요? 계좌번호를 클릭해 복사한 후 토스/카카오톡 송금으로 서버 유지비를 후원하실 수 있습니다.
                  </p>
                </div>
              </div>
              <button
                onClick={handleCopyDonation}
                className="w-full md:w-auto px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold rounded-xl transition-all text-center text-xs md:text-sm shadow-md active:scale-98 flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                {donationCopied ? (
                  <>
                    <Check size={16} className="text-green-300" />
                    계좌 복사 완료!
                  </>
                ) : (
                  <>
                    🍁 후원 계좌 복사하기 &rarr;
                  </>
                )}
              </button>
            </div>

          </div>
        )}
      </main>

      {/* 하단 슬림형 네온 광고판 (수익화 2) */}
      <div className="max-w-4xl w-full mx-auto px-4 mb-4">
        <div className="w-full py-4 px-5 rounded-xl border border-dashed border-slate-800 bg-slate-950/20 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <div>
            <div className="text-[11px] text-slate-400 font-bold font-sans">🍁 ADVERTISING SPACE</div>
            <p className="text-[9px] text-slate-550 mt-0.5">
              메이플랜드 쌀먹 및 장사 매크로 방지 관련 배너 스폰서를 받습니다.
            </p>
          </div>
          <a 
            href={SPONSOR_CONTACT.startsWith('http') ? SPONSOR_CONTACT : `mailto:${SPONSOR_CONTACT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-orange-400 hover:text-orange-300 font-semibold border border-orange-500/30 hover:border-orange-500/60 rounded px-2.5 py-1 transition-all"
          >
            스폰서 등록 문의 &rarr;
          </a>
        </div>
      </div>

      {/* 푸터 */}
      <footer className="w-full py-6 px-4 text-center border-t border-slate-850 bg-slate-950/40 text-slate-600 text-[10px] z-10">
        <p className="max-w-md mx-auto leading-relaxed font-sans">
          본 환전소는 놀이용 시뮬레이터입니다. 실시간 랭킹 정보는 네이버 금융 코스피 시가총액 및 글로벌 암호화폐 시가총액 데이터를 따르며, 부동산/자동차 가격은 국토부 실거래 등을 참조합니다.
        </p>
      </footer>

    </div>
  )
}

export default App
