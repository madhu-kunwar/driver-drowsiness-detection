import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DB_TOKEN } from "../db/db.module";
import type { Db } from "../db";
import { users } from "../db/schema";
import type { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class UsersService {
  constructor(@Inject(DB_TOKEN) private db: Db) {}

  async findById(id: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new NotFoundException("User not found");
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    await this.db.update(users).set(dto).where(eq(users.id, id));
    return this.findById(id);
  }

  async findAll() {
    const all = await this.db.select().from(users);
    return all.map(({ passwordHash: _, ...u }) => u);
  }
}
