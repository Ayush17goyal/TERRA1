import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { ContractConfig, ContractAcceptance } from './contract.entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContractConfig, ContractAcceptance]),
  ],
  controllers: [ContractController],
  providers: [ContractService],
  exports: [ContractService],
})
export class ContractModule {}
