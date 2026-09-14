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
  // shadcn은 npm 패키지가 아니라 복사 소스 → @radix-ui/* 의존성으로 감지
  if (Object.keys(dependencies).some((k) => k.startsWith('@radix-ui/'))) return 'shadcn';
  for (const name of STYLED_LIBRARY_ALLOWLIST) {
    if (Object.prototype.hasOwnProperty.call(dependencies, name)) return name;
  }
  return null;
}
