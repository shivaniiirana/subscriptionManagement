import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dtos/createUser.dto';
import { UpdateUserDto } from './dtos/updateUser.dto';
import { StripeService } from 'src/stripe/stripe.service';


@Injectable()
export class UserService {

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly stripeService: StripeService,
  ) {}

  async create(createDto: CreateUserDto) {
    
    const stripeCustomer = await this.stripeService.client.customers.create({
      email: createDto.email,
      name: createDto.name,
     
    });

    const user = new this.userModel({
      ...createDto,
      stripeCustomerId: stripeCustomer.id,
    });

    await user.save();
    return user;
  }

  async findAll() {
    return this.userModel.find();
  }

  async findOne(id: string) {
    return this.userModel.findById(id);
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email });
  }

  async update(id: string, updateDto: UpdateUserDto) {
    const user = await this.userModel.findByIdAndUpdate(id, updateDto, {
      new: true,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async remove(id: string) {
    return this.userModel.findByIdAndDelete(id);
  }
}
