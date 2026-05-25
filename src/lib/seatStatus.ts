export const SEAT_STATUS_LABEL: Record<string, string> = {
  available:    '사용가능',
  occupied:     '이용중',
  reserved:     '자리맡음',
  ghost:        '자리비움',
  managed:      '자율관리위원회',
  unauthorized: '무단점유',
  lost_item:    '분실물',
};

export const SEAT_STATUS_CLASS: Record<string, string> = {
  available:    'bg-green-100 text-green-700',
  occupied:     'bg-red-100 text-red-700',
  reserved:     'bg-yellow-100 text-yellow-700',
  ghost:        'bg-gray-100 text-gray-500',
  managed:      'bg-blue-100 text-blue-700',
  lost_item:    'bg-orange-100 text-orange-700',
  unauthorized: 'bg-red-100 text-red-700',
};
