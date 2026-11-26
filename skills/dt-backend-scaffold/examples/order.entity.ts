// EXAMPLE Phase 1 entities for the 'orders' module — TypeORM 판(stack.orm = typeorm).
// schema.delta.prisma 와 같은 모델이다. Phase 1 은 src/orders/entities/ 에 이것을 쓰고, tsc 가 검사한다.
// Phase 2 의 저장소가 `npm run migration:generate -- src/database/migrations/AddOrders` 로 마이그레이션을 만들고
// `migration:run` 으로 dev DB 에 적용한다. 게이트 `--orm-check migrations` 가 빠뜨린 마이그레이션을 잡는다.
//
// 엔티티는 저장소 밖에서 가져와도 되는 자리다(stackAdapters typeorm allowedPaths). 서비스·컨트롤러·DTO 는 가져오지 않는다 —
// 그 계층은 contract 의 도메인 Model(Order)을 쓴다.
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

export enum OrderStatus {
  created = 'created',
  paid = 'paid',
  shipped = 'shipped',
}

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  customerId!: string;

  @Column('int')
  total!: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.created })
  status!: OrderStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => OrderItemEntity, (item) => item.order, { cascade: true })
  items!: OrderItemEntity[];
}

@Entity('order_items')
export class OrderItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  orderId!: string;

  @Column('int')
  price!: number;

  @Column('int')
  qty!: number;

  @ManyToOne(() => OrderEntity, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order!: OrderEntity;
}
