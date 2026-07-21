import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";
import { sequelize } from "../../lib/db";

export class Event extends Model<InferAttributes<Event>, InferCreationAttributes<Event>> {
  declare id: CreationOptional<number>;
  declare title: string;
  declare gameType: string;
  declare startsAt: Date;
  declare location: string;
  declare capacity: number;
  /** Denormalized live attendee count, maintained transactionally with signups. */
  declare seatsTaken: CreationOptional<number>;
  declare organizerId: CreationOptional<number | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Event.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.TEXT, allowNull: false },
    gameType: { type: DataTypes.TEXT, allowNull: false },
    startsAt: { type: DataTypes.DATE, allowNull: false },
    location: { type: DataTypes.TEXT, allowNull: false },
    capacity: { type: DataTypes.INTEGER, allowNull: false },
    seatsTaken: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    organizerId: { type: DataTypes.INTEGER, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "events",
    schema: "game_night",
    underscored: true,
  },
);
