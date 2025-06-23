import { Injectable, NotFoundException } from '@nestjs/common';
import { PutCartPayload } from 'src/order/type';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart, CartStatus } from '../entities/cart.entity';
import { CartItem } from '../entities/cart-item.entity';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private cartItemRepository: Repository<CartItem>,
  ) {}

  async findCartByUserId(userId: string): Promise<Cart> {
    const cart = await this.cartRepository.findOne({
      where: { userId, status: CartStatus.OPEN },
      relations: ['items'],
    });

    if (!cart) {
      throw new NotFoundException(`Cart not found for user ${userId}`);
    }

    return cart;
  }

  async createCart(userId: string): Promise<Cart> {
    const cart = this.cartRepository.create({
      userId,
      status: CartStatus.OPEN,
      items: [],
    });

    await this.cartRepository.save(cart);
    return cart;
  }

  async findOrCreateCart(userId: string): Promise<Cart> {
    let cart;
    try {
      cart = await this.findCartByUserId(userId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        cart = await this.createCart(userId);
      }
      throw error;
    }

    return cart;
  }

  async updateByUserId(userId: string, payload: PutCartPayload): Promise<Cart> {
    const userCart = await this.findOrCreateCart(userId);

    const existingCartItem = userCart.items.find(
      ({ productId }) => productId === payload.product.id,
    );

    if (!existingCartItem || payload.count > 0) {
      const newCartItem = this.cartItemRepository.create({
        cart: userCart,
        cartId: userCart.id,
        productId: payload.product.id,
        count: payload.count,
      });
      await this.cartItemRepository.save(newCartItem);
    }

    if (existingCartItem) {
      if (payload.count === 0) {
        await this.cartItemRepository.remove(existingCartItem);
      } else {
        existingCartItem.count = payload.count;
        await this.cartItemRepository.save(existingCartItem);
      }
    }

    return this.findCartByUserId(userId);
  }

  async deleteCart(userId: string): Promise<void> {
    const cart = await this.findCartByUserId(userId);
    if (cart) {
      await this.cartRepository.delete({ id: cart.id });
    }
  }
}
