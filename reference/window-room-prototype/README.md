# 창가 빛이 드는 방 — 3D 시안

첫 화면 3D 장면 작업([PROJECT_AUDIT.md](../../PROJECT_AUDIT.md) "남은 것" 1번)의 기준이 되는 시안이다. 2026-11-16에 저장소 밖 폴더에서 만든 것을 그대로 옮겼다. 앱 코드와 연결되지 않은 참고 자료라서 테스트(`npm test`)와 아티팩트 묶음(`npm run artifact`)에는 들어가지 않는다.

## 열기

저장소 루트에서:

```bash
node reference/window-room-prototype/serve.mjs
```

http://127.0.0.1:4173 을 연다. 포트는 인자로 바꾼다(`node reference/window-room-prototype/serve.mjs 4174`). 앱(`npm start`, 5173)과 같이 띄워도 된다. 주소 뒤에 `?nowebgl`을 붙이면 WebGL이 없을 때 보이는 정지 이미지를 볼 수 있다.

## 들어 있는 것

| 경로 | 내용 |
| --- | --- |
| `index.html`, `css/`, `js/site.js` | 페이지: 스크롤 다섯 장, 컬렉션, 문의 예시 |
| `js/scene.js` | 장면, 카메라 경로, 조명(창 모양 스폿 하나), 후처리(GTAO, 보케 렌즈 심도, 필름 입자) |
| `js/furniture.js` | 코드로 만든 가구 형상. 바깥 치수 상수 `SIZES` |
| `js/textures.js` | 코드로 그린 나무결·부클레·직조 텍스처 |
| `vendor/three/` | three.js r169와 쓰는 addon(MIT, `LICENSE` 포함) |
| `fonts/` | Pretendard 서브셋, IBM Plex Mono(OFL, 라이선스 파일 포함) |
| `assets/room-still.jpg` | WebGL이 없을 때 쓰는 정지 이미지(이 장면을 찍은 것) |
| `shots-v3/` | 시안 캡처(해상도별, 다크, 정지 이미지) |
| `PROTOTYPE_NOTES.md` | 시안의 디자인 결정과 3D 장면 설명 |

## 앱에 옮길 때

- **디자인 기준은 [docs/DESIGN_SYSTEM.md](../../docs/DESIGN_SYSTEM.md)다.** 시안은 Pretendard + IBM Plex Mono를 쓰지만 앱은 IBM Plex Sans KR + IBM Plex Mono다. 시안의 서체와 토큰은 가져오지 않는다.
- **가져올 것은 장면 기법이다.** 창 모양 스폿 조명 하나, GTAO 접촉 음영, 보케 렌즈 심도, 장면 배경을 페이지 바탕과 픽셀까지 맞추는 톤 매핑 역보정, 터치 기기에서 효과를 단계적으로 끄는 처리.
- **렌더 방식이 다르다.** 시안은 실시간 후처리(GTAO·보케)이고, 앱의 `src/three/stage.js`는 멈추면 샘플을 누적하는 렌더다([docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)). 둘을 어떻게 합칠지가 이 작업의 핵심 결정이다.
- **three.js 버전이 다르다.** 시안은 r169, 앱의 `vendor/three.module.min.js`는 r170이다. 시안의 addon을 앱으로 옮길 때 r170 것으로 맞춘다.
- **남은 문제:** 정지 이미지가 밝은 배경으로 찍혀 있어 다크 화면에서 밝은 사각형으로 보인다.
- 제품명·치수·문의 양식은 시안용 예시다. 문의는 전송되지 않는다.
- 처음 만든 v1(다른 도구의 시작 파일 기반, 49MB)과 도구 캐시는 옮기지 않았다.
