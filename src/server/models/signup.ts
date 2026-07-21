import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from "sequelize";
import { sequelize } from "../../lib/db";
import type { User } from "./user";

/**
 * A player's active RSVP for an event. The row's existence == an active RSVP;
 * cancelling deletes the row. A UNIQUE(event_id, user_id) constraint (see the
 * SQL migration) guarantees at most one active RSVP per player per event (S2).
 */
export class Signup extends Model<InferAttributes<Signup>, InferCreationAttributes<Signup>> {
  declare id: CreationOptional<number>;
  declare eventId: number;
  declare userId: number;
  declare createdAt: CreationOptional<Date>;
  /** Present only when a query eager-loads the `user` association. */
  declare user?: NonAttribute<User>;
}

Signup.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    eventId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    createdAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "signups",
    schema: "game_night",
    underscored: true,
    updatedAt: false, // signups are immutable once created
  },
);
