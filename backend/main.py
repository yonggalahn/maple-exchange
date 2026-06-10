import math
import urllib.request
import json
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yfinance as yf
from bs4 import BeautifulSoup

app = FastAPI(
    title="방구석 자산 환전소 API (시가총액 랭킹 고도화)",
    description="시가총액 상위 주식/코인 랭킹 연동 및 아파트/자동차 변환 API",
    version="6.0.0"
)

# React 프론트엔드 연동을 위한 CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# [1] 실시간 주식 TOP 3 파이프라인 (네이버 금융 시가총액 스크래핑 + yfinance 폴백)
# ==========================================
def get_stock_price_helper(ticker_symbol: str, fallback_price: float) -> float:
    try:
        ticker = yf.Ticker(ticker_symbol)
        hist = ticker.history(period="5d")
        if not hist.empty:
            last_price = float(hist['Close'].iloc[-1])
            if last_price > 0:
                return last_price
        return fallback_price
    except:
        return fallback_price

def get_top_3_stocks() -> list[dict]:
    """
    네이버 금융 코스피 시가총액 상위 페이지를 크롤링하여 시총 상위 3개 주식의 실시간가와 시가총액을 가져옵니다.
    실패 시 KOSPI 시총 3대장(삼성전자, SK하이닉스, LG에너지솔루션)으로 폴백합니다.
    """
    url = "https://finance.naver.com/sise/sise_market_sum.naver?sosok=0"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=3) as response:
            html = response.read().decode('cp949', errors='ignore')
            soup = BeautifulSoup(html, 'html.parser')
            
            tr_list = soup.select('table.type_2 tr')
            stocks = []
            rank = 1
            
            for tr in tr_list:
                a_tag = tr.select_one('a.tltle')
                if a_tag:
                    name = a_tag.get_text(strip=True)
                    tds = tr.select('td.number')
                    if len(tds) >= 5:
                        # tds[0]: 현재가
                        price_str = tds[0].get_text(strip=True).replace(',', '')
                        price = float(price_str)
                        # tds[4]: 시가총액 (억 원 단위)
                        market_cap_eok_str = tds[4].get_text(strip=True).replace(',', '')
                        market_cap = float(market_cap_eok_str) * 100000000.0  # 원화로 환산
                        
                        stocks.append({
                            "rank": rank,
                            "name": name,
                            "price": price,
                            "market_cap": market_cap,
                            "tag": "🔥대장주" if rank == 1 else ""
                        })
                        rank += 1
                        if rank > 3:
                            break
            if len(stocks) == 3:
                return stocks
            raise ValueError("크롤링 데이터 부족")
            
    except Exception as e:
        print(f"[주식 시총 랭킹] 크롤링 오류로 폴백 적용: {e}")
        # 폴백: 삼성전자(005930.KS, 시총 ~430조), SK하이닉스(000660.KS, 시총 ~150조), LG에너지솔루션(373220.KS, 시총 ~90조)
        prices = {
            "삼성전자": get_stock_price_helper("005930.KS", 300000.0),
            "SK하이닉스": get_stock_price_helper("000660.KS", 2000000.0),
            "LG에너지솔루션": get_stock_price_helper("373220.KS", 400000.0)
        }
        return [
            {"rank": 1, "name": "삼성전자", "price": prices["삼성전자"], "market_cap": 430000000000000.0, "tag": "🔥대장주"},
            {"rank": 2, "name": "SK하이닉스", "price": prices["SK하이닉스"], "market_cap": 150000000000000.0, "tag": ""},
            {"rank": 3, "name": "LG에너지솔루션", "price": prices["LG에너지솔루션"], "market_cap": 90000000000000.0, "tag": ""}
        ]

# ==========================================
# [2] 실시간 코인 TOP 3 파이프라인 (글로벌 시가총액 + 업비트 실시간 시세 매핑)
# ==========================================
def get_upbit_ticker_price(symbol: str, fallback_price: float) -> float:
    """단일 코인 가격 조회를 위한 업비트 보조기"""
    url = f"https://api.upbit.com/v1/ticker?markets=KRW-{symbol}"
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=2) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data and len(data) > 0:
                return float(data[0]['trade_price'])
        return fallback_price
    except:
        return fallback_price

def get_top_3_coins() -> list[dict]:
    """
    CoinGecko 글로벌 암호화폐 시장 API를 통해 시가총액 상위 코인을 수집하고,
    업비트에 상장된 원화마켓 코인의 실시간 시세를 매핑하여 반환합니다.
    실패 시 K-코인 대장 3대장(비트코인, 이더리움, 솔라나) 고정 템플릿으로 폴백합니다.
    """
    gecko_url = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=krw&order=market_cap_desc&per_page=10&page=1&sparkline=false"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    
    try:
        # 1. 업비트 원화 마켓 한글명 리스트 사전에 수집
        market_all_url = "https://api.upbit.com/v1/market/all"
        req_upbit_all = urllib.request.Request(market_all_url, headers=headers)
        with urllib.request.urlopen(req_upbit_all, timeout=2) as response:
            markets_data = json.loads(response.read().decode('utf-8'))
            krw_markets = {item['market'].replace("KRW-", ""): item['korean_name'] for item in markets_data if item['market'].startswith('KRW-')}
        
        # 2. CoinGecko 글로벌 시가총액 순위 로드
        req_gecko = urllib.request.Request(gecko_url, headers=headers)
        with urllib.request.urlopen(req_gecko, timeout=3) as response:
            gecko_data = json.loads(response.read().decode('utf-8'))
            
            top_3 = []
            rank = 1
            for coin in gecko_data:
                symbol = coin['symbol'].upper()
                # 업비트 원화 마켓에 상장되어 있는 코인만 필터링
                if symbol in krw_markets:
                    coin_name = krw_markets[symbol]
                    # 실시간 현재가는 업비트에서 최신화
                    live_price = get_upbit_ticker_price(symbol, float(coin['current_price']))
                    
                    top_3.append({
                        "rank": rank,
                        "name": coin_name,
                        "symbol": symbol,
                        "price": live_price,
                        "market_cap": float(coin['market_cap']),
                        "tag": "🐋고래픽" if rank == 1 else ""
                    })
                    rank += 1
                    if rank > 3:
                        break
            if len(top_3) == 3:
                return top_3
            raise ValueError("코인 시총 매핑 데이터 부족")
            
    except Exception as e:
        print(f"[코인 시총 랭킹] API 오류로 폴백 적용: {e}")
        # 폴백: 비트코인(BTC, 시총 ~1800조), 이더리움(ETH, 시총 ~500조), 솔라나(SOL, 시총 ~100조)
        prices = {
            "BTC": get_upbit_ticker_price("BTC", 95000000.0),
            "ETH": get_upbit_ticker_price("ETH", 4800000.0),
            "SOL": get_upbit_ticker_price("SOL", 250000.0)
        }
        return [
            {"rank": 1, "name": "비트코인", "symbol": "BTC", "price": prices["BTC"], "market_cap": 1800000000000000.0, "tag": "🐋고래픽"},
            {"rank": 2, "name": "이더리움", "symbol": "ETH", "price": prices["ETH"], "market_cap": 500000000000000.0, "tag": ""},
            {"rank": 3, "name": "솔라나", "symbol": "SOL", "price": prices["SOL"], "market_cap": 100000000000000.0, "tag": ""}
        ]

# 환율 매핑 정보 (메이플랜드: 1,000만 메소 = 1,800원)
MESO_RATE_UNIT = 10000000
KRW_RATE_UNIT = 1800

# 환율 매핑 정보 (라이브 본섭: 1억 메소 기준)
LIVE_RATE_UNIT = 100000000
LIVE_RATE_CITY = 1600     # 주요 도시 서버 (스카니아 등) 평균 1,600원
LIVE_RATE_RURAL = 1850    # 외곽 서버 (노바 등) 평균 1,850원
LIVE_RATE_MARKET = 2200   # 공식 메소마켓 환산가 2,200원

# ==========================================
# [3] 부동산 및 자동차 스펙 데이터
# ==========================================
APARTMENT_SPECS = {
    "seoul": {
        "name": "강남 타워팰리스 1차",
        "total_price": 3500000000,
        "pyeong_size": 50,
        "comments": [
            (0.0001, "타워팰리스 공동현관 번호판 로비폰 액정의 기스 면적 확보!"),
            (0.001, "타워팰리스 욕실 샤워기 수도꼭지 메탈 밸브 1개 면적 확보!"),
            (0.01, "타워팰리스 최고급 대리석 거실 바닥 모퉁이 미세한 파편 면적 확보!"),
            (0.1, "타워팰리스 빌트인 식기세척기 도어 전면 철판 크기 확보!"),
            (0.5, "타워팰리스 현관 센서등이 감지하는 바닥 타일 1장 면적 확보!"),
            (1.0, "타워팰리스 드레스룸 넥타이 걸이용 슬라이딩 옷걸이 설치 면적 확보!"),
            (3.0, "타워팰리스 금빛 찬란한 변기가 놓인 개인 화장실 영역 확보!"),
            (5.0, "타워팰리스 최고급 빌트인 냉장고 2대가 들어갈 미니 팬트리 공간 확보!"),
            (10.0, "타워팰리스 가구 없는 게스트용 미니 서재 방 크기 면적 확보!"),
            (float('inf'), "기적이 일어났습니다! 강남 타워팰리스 실평수 단독 소유주 등극!")
        ],
        "comments_live": [
            (0.0001, "타워팰리스 로비 정문 회전문의 유리에 묻은 뉴비의 지문 면적 확보!"),
            (0.001, "타워팰리스 엘리베이터 호출 버튼 구리 배선 1cm 확보!"),
            (0.01, "타워팰리스 우편함 마그네틱 도어 걸쇠 판 크기 확보!"),
            (0.1, "타워팰리스 복도 비상용 소화전 붉은색 커버 철판 면적 확보!"),
            (0.5, "타워팰리스 세대 내 다용도 보조 주방 가스누출 경보기 크기 확보!"),
            (1.0, "타워팰리스 안방 드레스룸 슬라이딩 도어 손잡이 크기 확보!"),
            (3.0, "타워팰리스 아메리칸 스탠다드 변기가 세워진 안방 부부욕실 영역 확보!"),
            (5.0, "타워팰리스 최고급 아일랜드 식탁 상판 최고급 화강암 공간 확보!"),
            (10.0, "타워팰리스 50평형 중 통창 너머로 시티뷰가 보이는 거실 절반 확보!"),
            (float('inf'), "강남 최고급 아파트 실평수 단독 등기! 대적자의 품격에 맞는 보금자리입니다.")
        ]
    },
    "gyeonggi": {
        "name": "인천 논현 웰카운티",
        "total_price": 350000000,
        "pyeong_size": 24,
        "comments": [
            (0.001, "인천 논현 아파트 인터폰 아래 벽지 스티커 면적 확보!"),
            (0.01, "인천 논현 아파트 욕실 세면대 비누 거치대 면적 확보!"),
            (0.1, "인천 논현 아파트 다용도실 보일러 조작 컨트롤러 박스 면적 확보!"),
            (0.5, "인천 논현 아파트 베란다 세탁기 아래 배수구 타일 1.5장 면적 확보!"),
            (1.0, "인천 논현 아파트 현관 발판 면적 확보! (하루에 10번은 밟을 내 땅)"),
            (3.0, "인천 논현 아파트 안방 딸린 미니 파우더룸 겸 화장대 영역 확보!"),
            (5.0, "인천 논현 아파트 컴퓨터 책상과 게이밍 체어가 겨우 들어가는 1인용 PC방 확보!"),
            (10.0, "인천 논현 아파트 침대와 옷장이 알맞게 들어가는 중간 크기 자녀방 확보!"),
            (20.0, "인천 논현 아파트 거실과 연결된 주방 식탁 공간까지 통째로 확보!"),
            (float('inf'), "수도권에 등기 쳤습니다! 인천 논현 24평형 아파트 집주인 완성!")
        ],
        "comments_live": [
            (0.001, "인천 논현 아파트 단지 주차장 차단기 스티커 면적 확보!"),
            (0.01, "인천 논현 아파트 복도 소방 센서 감지기 면적 확보!"),
            (0.1, "인천 논현 아파트 베란다 세탁기용 수도꼭지 1개 면적 확보!"),
            (0.5, "인천 논현 아파트 안방 전등 스위치 플레이트 1개 면적 확보!"),
            (1.0, "인천 논현 아파트 발코니 샷시 레일 2칸 길이 면적 확보! (바람은 막아줌)"),
            (3.0, "인천 논현 아파트 주방 빌트인 식기건조대 슬라이딩 망 공간 확보!"),
            (5.0, "인천 논현 아파트 컴퓨터 책상과 트리플 모니터가 들어가는 1.5평 PC방 공간!"),
            (10.0, "인천 논현 아파트 킹사이즈 침대와 옷장이 알맞게 들어가는 안방 구역 확보!"),
            (20.0, "인천 논현 아파트 거실 소파 배치 구역부터 베란다까지 시원하게 지배!"),
            (float('inf'), "수도권에 드디어 내 집 등기를 완료했습니다! 에스페라 바다보다 넓은 내 집 소유!")
        ]
    },
    "gumi": {
        "name": "경북 구미시 구포성원아파트",
        "total_price": 70000000,
        "pyeong_size": 24,
        "comments": [
            (0.001, "구포성원 아파트 욕조 물막이 고무마개 면적 확보!"),
            (0.01, "구포성원 아파트 싱크대 배수망 거름통 윗면 크기 확보!"),
            (0.1, "경북 구미시 구포성원 아파트 안방 발코니 타일 3장 면적 확보!"),
            (0.5, "구포성원 아파트 현관문 앞 우편함 박스 내부 적재 면적 확보!"),
            (1.0, "구포성원 아파트 다용도실 김치냉장고 단독 설치 면적 확보!"),
            (3.0, "구포성원 아파트 퀸사이즈 침대가 통째로 안착 가능한 안방 일부분 확보!"),
            (5.0, "구포성원 아파트 24평형의 가장 작은 옷방 면적 확보! 행거 설치 가능."),
            (10.0, "구포성원 아파트 큰방과 욕실을 커버하는 메인 프라이빗 구역 확보!"),
            (20.0, "구포성원 아파트 방 3개 중 2개와 거실 일부를 지배하는 준 실소유주!"),
            (float('inf'), "축하합니다! 구포성원 아파트 등기권리증 단독 획득!")
        ],
        "comments_live": [
            (0.001, "구포성원 아파트 싱크대 배수구 거름망 커버 면적 확보!"),
            (0.01, "구포성원 아파트 보일러 온도 조절 다이얼 면적 확보!"),
            (0.1, "구포성원 아파트 화장실 환풍기 날개 3개 분량 면적 확보!"),
            (0.5, "구포성원 아파트 베란다 창틀 빗물 구멍 물막이 방충망 크기 확보!"),
            (1.0, "구포성원 아파트 다용도실 드럼세탁기 단독 설치 면적 확보!"),
            (3.0, "구포성원 아파트 싱글 사이즈 침대와 책상이 들어가는 아담한 침방 공간!"),
            (5.0, "구포성원 아파트 4인용 식탁과 냉장고가 들어갈 다이닝룸 공간 완벽 점령!"),
            (10.0, "구포성원 아파트 안방 침실 전체와 화장대 공간 확보!"),
            (20.0, "구포성원 아파트 거실 전체와 베란다를 통합한 넓은 구역 지배!"),
            (float('inf'), "축하합니다! 구미 구포성원아파트 온전한 내 집 마련 등기권리증 획득!")
        ]
    }
}

CAR_SPECS = {
    "avante": {
        "name": "현대 아반떼 신차",
        "price": 25000000,
        "comments": [
            (0.01, "아반떼 하이브리드 앞바퀴 순정 휠볼트 1개 획득! 굴러가기엔 아직 한참 멉니다."),
            (0.05, "아반떼 대시보드 컵홀더 고무 패드 및 스마트폰 무선 충전 패드 면적 확보!"),
            (0.2, "아반떼 17인치 알로이 휠 1개 및 순정 바닥 매트 확보!"),
            (0.5, "아반떼 가죽 스티어링 휠(핸들) 및 전면 와이퍼 세트 획득! 비 올 때 앞은 보입니다."),
            (1.0, "아반떼 하이브리드 1.6 엔진 실린더 헤드 및 LED 헤드램프 조수석 획득!"),
            (float('inf'), "현대 아반떼 신차 완차 출고 가능! 첫 차로 메이플랜드 사냥터 출퇴근하세요.")
        ],
        "comments_live": [
            (0.01, "아반떼 신차 전면 범퍼 그릴 메쉬 구멍 3개 확보! 갈 길은 멉니다."),
            (0.05, "아반떼 도어 손잡이 내부 스마트 버튼 키 센서 모듈 면적 확보!"),
            (0.2, "아반떼 17인치 순정 알로이 휠 2개 및 스마트스트림 밸브 확보!"),
            (0.5, "아반떼 D컷 가죽 스티어링 휠 핸들 및 하이브리드 계기판 12.3인치 스크린 확보!"),
            (1.0, "아반떼 1.6 엔진 실린더 블록 및 앞좌석 통풍시트 획득! 쾌적하게 사냥터 퇴근 가능."),
            (float('inf'), "현대 아반떼 완차 일시불 계약 완료! 첫 차 타고 헤네시스 광장으로 출퇴근하세요.")
        ]
    },
    "g80": {
        "name": "제네시스 G80",
        "price": 70000000,
        "comments": [
            (0.01, "제네시스 G80 스마트 키 가죽 키케이스 및 엠블럼 스티커 획득!"),
            (0.05, "제네시스 G80 도어 트림 리얼 우드 가니쉬 및 웰컴 라이트 확보!"),
            (0.2, "제네시스 G80 19인치 디쉬타입 휠 1개 및 에어 서스펜션 에어백 1개 획득!"),
            (0.5, "제네시스 G80 조수석 천연가죽 시트 및 엠비언트 무드 라이트 제어장치 확보!"),
            (1.0, "제네시스 G80 14.5인치 인포테인먼트 광활한 디스플레이 및 다이얼 기어 변속기 확보!"),
            (float('inf'), "제네시스 G80 풀옵션 계약 가능! 이제 헤네시스 사냥터에 멋지게 주차해 두세요.")
        ],
        "comments_live": [
            (0.01, "제네시스 G80 트렁크 리드 크롬 레터링 엠블럼 1글자 획득!"),
            (0.05, "제네시스 G80 전자식 변속 노브 유리 캡 면적 확보!"),
            (0.2, "제네시스 G80 시그니쳐 셀렉션 리얼 알루미늄 내장재 조각 획득!"),
            (0.5, "제네시스 G80 18way 에르고 모션 운전석 마사지 시트 확보!"),
            (1.0, "제네시스 G80 프리뷰 전자제어 서스펜션 장치 및 14.5인치 와이드 스크린 확보!"),
            (float('inf'), "제네시스 G80 오너 등극! 품격 있는 대적자라면 럭셔리 대형 세단 정도는 타야죠.")
        ]
    },
    "ferrari": {
        "name": "페라리 로마",
        "price": 350000000,
        "comments": [
            (0.01, "페라리 로마 스마트키 말 모양 금속 엠블럼 및 밸브 캡 획득! 주머니에 넣고 다닐 만함."),
            (0.05, "페라리 로마 카본 파이버 스티어링 휠 상단 LED 인디케이터 부품 1개 확보!"),
            (0.2, "페라리 로마 카본 세라믹 브레이크 디스크 1장 및 노란색 브레이크 캘리퍼 획득!"),
            (0.5, "페라리 로마 조수석 전용 보조 디스플레이 모니터 및 가죽 마감재 확보!"),
            (1.0, "페라리 로마 V8 트윈터보 엔진 배기 밸브 매니폴드 및 실린더 피스톤 2개 확보!"),
            (float('inf'), "페라리 로마 뽑고 기름 만땅 주유 가능! 주황버섯 컷오프 속도로 질주하세요.")
        ],
        "comments_live": [
            (0.01, "페라리 로마 스마트키 실버 프레임 테두리 나사 헤드 면적 확보!"),
            (0.05, "페라리 로마 5포크 알로이 휠 카본 파이버 휠 캡 노란 말 엠블럼 확보!"),
            (0.2, "페라리 로마 카본 브레이크 디스크 및 실내 알칸타라 대시보드 마감재 조각 확보!"),
            (0.5, "페라리 로마 V8 트윈터보 엔진 블록 상부 마그네슘 매니폴드 밸브 확보!"),
            (1.0, "페라리 로마 배기 매니폴드 촉매 변환기 및 8단 듀얼클러치 미션 하우징 확보!"),
            (float('inf'), "페라리 로마 완차 계약 완료! 제네시스 무기보다 빠른 속도로 현실의 도로를 질주하세요.")
        ]
    }
}

class ApartmentDetail(BaseModel):
    name: str
    total_price: int
    pyeong_size: int
    pyeong_price: int
    pyeong: float
    m2: float
    comment: str

class CarDetail(BaseModel):
    name: str
    price: int
    qty: float
    comment: str

class StockItem(BaseModel):
    rank: int
    name: str
    price: float
    market_cap: float  # 추가
    qty: float
    tag: str

class CoinItem(BaseModel):
    rank: int
    name: str
    symbol: str
    price: float
    market_cap: float  # 추가
    qty: float
    tag: str

class ExchangeResponse(BaseModel):
    meso: int
    krw: int
    stocks: list[StockItem]
    coins: list[CoinItem]
    apartments: dict[str, ApartmentDetail]
    cars: dict[str, CarDetail]
    jajangmyeon_qty: float
    tier_name: str
    tier_desc: str

def get_apartment_comment(key: str, pyeong: float, game_type: str = "mapleland") -> str:
    specs = APARTMENT_SPECS[key]
    comments = specs.get("comments_live" if game_type == "live" else "comments")
    for limit, comment in comments:
        if pyeong < limit:
            return comment
    return comments[-1][1]

def get_car_comment(key: str, qty: float, game_type: str = "mapleland") -> str:
    specs = CAR_SPECS[key]
    comments = specs.get("comments_live" if game_type == "live" else "comments")
    for limit, comment in comments:
        if qty < limit:
            if limit == float('inf'):
                return comment.format(int(qty)) if "{}" in comment else comment
            return comment
    return comments[-1][1]

def get_tier_info(meso: int, game_type: str = "mapleland") -> tuple[str, str]:
    if game_type == "live":
        if meso < 100000000:  # 1억 미만
            return "헤네시스 택시 무임승차범", "달팽이 세 마리 스킬 마스터. 재획비 살 돈도 없어서 물약값 걱정하는 신세입니다."
        elif meso < 1000000000:  # 10억 미만
            return "재획비 마시는 광부", "리멘 사냥터에서 숨 쉬듯 재획하는 자산 규모. 치킨 한 마리는 내 손으로 벌어 먹습니다."
        elif meso < 10000000000:  # 100억 미만
            return "카루타 보스 먹자 대장", "주간 보스 돌이로 쏠쏠한 용돈을 챙깁니다. 구미 아파트 문짝 리모델링 비용을 메소로 치를 만합니다."
        elif meso < 100000000000:  # 1000억 미만
            return "칠흑의 디스트로이어", "칠흑 아이템 먹튀 소문의 주인공. 아반떼 중고 정도는 메소마켓 털어 즉시 일시불 출고 가능합니다."
        else:
            return "메이플스토리 최대주주", "강원기 디렉터님과 이사회를 소집할 만한 자산가. 구미 아파트 한 채 등기는 우스운 수준입니다."
    else:
        if meso < 10000000:
            return "동네 달팽이 학살자", "메이플랜드 남의 집 냄비나 훔쳐보는 수준. 컵라면 국물만 핥아 먹는 자산 규모입니다."
        elif meso < 100000000:
            return "방구석 헤네시스 중산층", "슬슬 커닝시티 웅이에게 말 걸 자격이 주어집니다. 주말에 교촌치킨 한 마리 뜯을 여유가 생겼습니다."
        elif meso < 1000000000:
            return "구미의 지배자 꿈나무", "남들은 낚시터에서 매크로 돌릴 때 땀 흘려 장사한 결과물! 구미 아파트에 주차 등록 정도는 시도해볼 수 있습니다."
        elif meso < 10000000000:
            return "자유시장 1채널 큰손", "지나갈 때 뉴비들이 인기도를 내리는 매력을 소유하고 있습니다. 구미 아파트 화장실을 온전히 리모델링할 수 있습니다."
        else:
            return "메이플랜드 만수르", "넥슨 김정주 회장님도 하늘에서 박수 칠 자산가. 구미 구축 아파트 단지 내 동 하나를 매입 검토할 만합니다."

@app.get("/")
def read_root():
    return {"message": "시가총액 랭킹 고도화 완료된 방구석 자산 환전소 API 가동중"}

@app.get("/api/exchange")
def exchange_meso_get(
    meso: int = Query(..., description="환전할 메소 금액"),
    game_type: str = Query("mapleland", description="게임 종류 (mapleland 또는 live)"),
    market_type: str = Query("city", description="본섭 시세 기준 (city, rural, market)")
):
    if meso < 0:
        raise HTTPException(status_code=400, detail="메소는 음수일 수 없습니다.")
    
    # 1. 원화 환산
    if game_type == "live":
        if market_type == "rural":
            rate = LIVE_RATE_RURAL
        elif market_type == "market":
            rate = LIVE_RATE_MARKET
        else:
            rate = LIVE_RATE_CITY
        krw = int((meso / LIVE_RATE_UNIT) * rate)
    else:
        krw = int((meso / MESO_RATE_UNIT) * KRW_RATE_UNIT)
    
    # 2. 실시간 주식 TOP 3 수집 및 환산 (시가총액순)
    raw_stocks = get_top_3_stocks()
    stocks_result = []
    for stock in raw_stocks:
        qty = krw / stock["price"]
        stocks_result.append(StockItem(
            rank=stock["rank"],
            name=stock["name"],
            price=stock["price"],
            market_cap=stock["market_cap"],
            qty=round(qty, 6),
            tag=stock["tag"]
        ))
        
    # 3. 실시간 코인 TOP 3 수집 및 환산 (시가총액순)
    raw_coins = get_top_3_coins()
    coins_result = []
    for coin in raw_coins:
        qty = krw / coin["price"]
        coins_result.append(CoinItem(
            rank=coin["rank"],
            name=coin["name"],
            symbol=coin["symbol"],
            price=coin["price"],
            market_cap=coin["market_cap"],
            qty=round(qty, 6),
            tag=coin["tag"]
        ))
    
    # 4. 부동산 단지별 실거래가 기반 연산
    apartments_result = {}
    for key, spec in APARTMENT_SPECS.items():
        total_price = spec["total_price"]
        pyeong_size = spec["pyeong_size"]
        pyeong_price = int(total_price / pyeong_size)
        pyeong = krw / pyeong_price
        m2 = pyeong * 3.30578
        comment = get_apartment_comment(key, pyeong, game_type)
        
        apartments_result[key] = ApartmentDetail(
            name=spec["name"],
            total_price=total_price,
            pyeong_size=pyeong_size,
            pyeong_price=pyeong_price,
            pyeong=round(pyeong, 6),
            m2=round(m2, 6),
            comment=comment
        )
        
    # 5. 자동차 3종 세트 연산
    cars_result = {}
    for key, spec in CAR_SPECS.items():
        car_price = spec["price"]
        qty = krw / car_price
        comment = get_car_comment(key, qty, game_type)
        
        cars_result[key] = CarDetail(
            name=spec["name"],
            price=car_price,
            qty=round(qty, 6),
            comment=comment
        )
        
    # 6. 생활 밀착형 짜장면
    jajangmyeon_qty = krw / 7000.0
    
    tier_name, tier_desc = get_tier_info(meso, game_type)
    
    return ExchangeResponse(
        meso=meso,
        krw=krw,
        stocks=stocks_result,
        coins=coins_result,
        apartments=apartments_result,
        cars=cars_result,
        jajangmyeon_qty=round(jajangmyeon_qty, 2),
        tier_name=tier_name,
        tier_desc=tier_desc
    )

class ExchangeRequest(BaseModel):
    meso: int
    game_type: str = "mapleland"
    market_type: str = "city"

@app.post("/api/exchange", response_model=ExchangeResponse)
def exchange_meso_post(request: ExchangeRequest):
    return exchange_meso_get(request.meso, request.game_type, request.market_type)
