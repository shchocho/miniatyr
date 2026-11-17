// seasons.js — 계절 테마. 방에 놓인 가구의 창밖 풍경, 창으로 드는 빛, 직물 소품의 색을 한 벌로 바꾼다.
// sun:  창으로 드는 빛 [색, 세기, 원판 반지름(작을수록 창살 그림자가 또렷하다)]
// sky:  창과 방 전체에서 오는 보조광 [색, 세기]
// fill: 카메라 쪽 보조광 [색, 세기]. 밤에는 방 안 스탠드 불빛 노릇을 한다
// glow: 창밖 풍경의 밝기, exposure: 노출
// accents·curtains·rugs: 쿠션·러그·커튼에 쓸 재질(data/materials.js 의 이름)
export const SEASONS = {
  spring: { name: '봄', view: '벚꽃', sun: ['#ffe4bf', 6.0, 0.014], sky: ['#ffffff', 1], fill: ['#ffffff', 1], glow: 1.3, exposure: 1,
    accents: ['fab-blush', 'fab-sage', 'fab-cream'], curtains: ['fab-blush', 'linen'], rugs: ['fab-cream', 'fab-natural'] },
  summer: { name: '여름밤', view: '은하수', sun: ['#9db8ff', 2.2, 0.012], sky: ['#7f9be6', 0.42], fill: ['#ffcb9c', 0.95], glow: 1.1, exposure: 0.95,
    accents: ['fab-navy', 'fab-teal', 'fab-cream'], curtains: ['linen'], rugs: ['fab-gray', 'jute'] },
  autumn: { name: '가을', view: '단풍', sun: ['#ffc88a', 6.5, 0.014], sky: ['#ffe6c8', 0.9], fill: ['#fff1e2', 1], glow: 1.15, exposure: 1,
    accents: ['fab-ochre', 'fab-terracotta', 'fab-natural'], curtains: ['fab-cream', 'linen'], rugs: ['jute', 'fab-natural'] },
  winter: { name: '겨울', view: '눈', sun: ['#eef4ff', 3.4, 0.04], sky: ['#e4eeff', 1.35], fill: ['#f4f8ff', 1.1], glow: 1.7, exposure: 1.04,
    accents: ['fab-cream', 'fab-charcoal', 'fab-navy'], curtains: ['fab-cream'], rugs: ['fab-gray', 'fab-cream'] },
};
