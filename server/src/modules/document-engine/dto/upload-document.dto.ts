import { IsIn, IsOptional, IsString } from 'class-validator';

export class UploadDocumentDto {
  @IsOptional()
  @IsString()
  @IsIn(['bare_act', 'case_compilation', 'notes', 'textbook'])
  documentTypeHint?: string;
}
