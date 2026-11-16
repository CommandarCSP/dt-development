// spec §3.1 — styled 컴포넌트 라이브러리 allowlist (closed).
// 순서 = 우선순위. headless 류(react-aria-components 등)는 포함하지 않는다(직접 구현 대상).
export const STYLED_LIBRARY_ALLOWLIST = [
  'antd',
  '@mui/material',
  '@chakra-ui/react',
  '@mantine/core',
  'react-bootstrap',
  'antd-mobile'
];

export function detectStyledLibrary(dependencies = {}) {
  // shadcn은 npm 패키지가 아니라 복사 소스 → Radix 의존성으로 감지. Radix 는 개별 패키지(@radix-ui/*)와
  // 통합 패키지(radix-ui) 두 방식이 있다 — 통합 패키지만 쓰는 프로젝트를 놓쳤던 것을 dt-adopt 검증에서 발견.
  if (Object.keys(dependencies).some((k) => k.startsWith('@radix-ui/') || k === 'radix-ui')) return 'shadcn';
  for (const name of STYLED_LIBRARY_ALLOWLIST) {
    if (Object.prototype.hasOwnProperty.call(dependencies, name)) return name;
  }
  return null;
}
