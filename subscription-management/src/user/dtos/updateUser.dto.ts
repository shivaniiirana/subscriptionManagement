import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'john.doe@example.com',
    description: 'Updated email address of the user',
  })
  email?: string;

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Updated name of the user',
  })
  name?: string;
}
