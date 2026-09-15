@Controller('orders')
export class OrdersController {
  @Get(':id') find(@Param('id') id: string) { return this.svc.find(id); }
  @Post() create(@Body() dto: CreateDto) { return this.svc.create(dto); }
}
