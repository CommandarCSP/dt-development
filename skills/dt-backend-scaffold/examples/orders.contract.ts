// EXAMPLE contract for the 'orders' module (NestJS).
// Phase 1 generates this at src/orders/contracts/orders.contract.ts.
// All Phase 2+ agents implement against these interfaces; the Phase 2 gate (tsc)
// enforces conformance. Keep this file free of Prisma/HTTP imports.

// ── Domain Model (Service ↔ Repository 사이의 내부 타입) ───────────────
export interface Order {
  id: string;
  customerId: string;
  total: number;
  status: 'created' | 'paid' | 'shipped';
  createdAt: Date;
}

export interface NewOrder {
  customerId: string;
  items: Array<{ price: number; qty: number }>;
}

// ── DTO 형태 (경계 계약 — be-builder가 DTO 계층을 class-validator DTO로 구현) ──────
export interface CreateOrderRequest {
  customerId: string;
  items: Array<{ price: number; qty: number }>;
}

export interface OrderResponse {
  id: string;
  customerId: string;
  total: number;
  status: Order['status'];
}

// ── Repository 계약 (be-builder가 Repository 계층을 Prisma로 구현) ─────────────────
export interface OrdersRepository {
  create(input: NewOrder): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  list(params: { limit: number; cursor?: string }): Promise<Order[]>;
}

// ── Service 계약 (be-builder가 Service 계층을 비즈니스 로직으로 구현) ───────────────
export interface OrdersService {
  place(req: CreateOrderRequest): Promise<OrderResponse>;
  findOne(id: string): Promise<OrderResponse>;
}
