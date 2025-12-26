import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeToBigint1735257600000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Change likes, views, and comments columns from integer to bigint
        await queryRunner.query(`
            ALTER TABLE "scraped_posts" 
            ALTER COLUMN "likes" TYPE bigint,
            ALTER COLUMN "views" TYPE bigint,
            ALTER COLUMN "comments" TYPE bigint;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert back to integer (data loss may occur if values exceed integer range)
        await queryRunner.query(`
            ALTER TABLE "scraped_posts" 
            ALTER COLUMN "likes" TYPE integer,
            ALTER COLUMN "views" TYPE integer,
            ALTER COLUMN "comments" TYPE integer;
        `);
    }
}
