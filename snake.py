"""贪吃蛇游戏 - 使用 Python/Pygame 实现的经典贪吃蛇，支持音效与金色食物机制。"""

import io
import math
import random
import struct
import sys
import wave

import pygame

# 初始化 pygame
pygame.init()
pygame.mixer.init(frequency=22050, size=-16, channels=1, buffer=512)


def generate_sound(frequency=440, duration=0.15, volume=0.5, sample_rate=22050):
    """通过正弦波动态生成音效，无需外部音频文件"""
    n_samples = int(sample_rate * duration)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        for i in range(n_samples):
            # 使用衰减包络让声音更自然
            envelope = max(0, 1.0 - (i / n_samples) * 1.5)
            sample = math.sin(2 * math.pi * frequency * i / sample_rate)
            val = int(volume * 32767 * envelope * sample)
            wf.writeframes(struct.pack("<h", max(-32768, min(32767, val))))
    buf.seek(0)
    return pygame.mixer.Sound(buf)


# 生成音效
eat_sound = generate_sound(frequency=880, duration=0.1, volume=0.4)  # 吃食物：短促高音
milestone_sound = generate_sound(
    frequency=1200, duration=0.3, volume=0.5
)  # 达到5倍数：成就音
gameover_sound = generate_sound(
    frequency=200, duration=0.5, volume=0.6
)  # 游戏结束：低沉音

# 定义颜色常量
WHITE = (255, 255, 255)
YELLOW = (255, 255, 102)
BLACK = (0, 0, 0)
RED = (213, 50, 80)
GREEN = (0, 255, 0)
BLUE = (50, 153, 213)
GOLD = (255, 215, 0)

# 设置屏幕大小
WIDTH = 600
HEIGHT = 400

# 创建游戏窗口
dis = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("贪吃蛇 - Python/Pygame")

clock = pygame.time.Clock()
snake_block = 15
snake_speed = 12

# 匹配系统中存在的支持中文的字体
font_name = pygame.font.match_font(
    ["simhei", "microsoftyahei", "dengxian", "fangsong", "simsun"]
)
if font_name is None:
    font_style = pygame.font.Font(None, 30)
    score_font = pygame.font.Font(None, 40)
    is_chinese_supported = False
else:
    font_style = pygame.font.Font(font_name, 30)
    score_font = pygame.font.Font(font_name, 40)
    is_chinese_supported = True


def display_score(score):
    """在屏幕左上角显示当前得分。"""
    if is_chinese_supported:
        value = score_font.render("得分: " + str(score), True, YELLOW)
    else:
        value = score_font.render("Score: " + str(score), True, YELLOW)
    dis.blit(value, [10, 10])


def draw_multiplier_hint():
    """当金色食物存在时，显示加倍提示"""
    if is_chinese_supported:
        hint = score_font.render("x2", True, GOLD)
    else:
        hint = score_font.render("x2", True, GOLD)
    dis.blit(hint, [WIDTH - 60, 10])


def draw_snake(block_size, snake_list):
    """绘制蛇身体的所有方块。"""
    for segment in snake_list:
        pygame.draw.rect(dis, GREEN, [segment[0], segment[1], block_size, block_size])


def show_message(msg, english_msg, color):
    """在屏幕中央显示提示消息。"""
    if is_chinese_supported:
        rendered = font_style.render(msg, True, color)
    else:
        rendered = font_style.render(english_msg, True, color)
    msg_rect = rendered.get_rect(center=(WIDTH / 2, HEIGHT / 2))
    dis.blit(rendered, msg_rect)


def game_loop():
    """游戏主循环，处理输入、更新状态和渲染画面。"""
    game_over = False
    game_close = False
    paused = False

    # 蛇的初始位置
    x1 = round((WIDTH / 2) / snake_block) * snake_block
    y1 = round((HEIGHT / 2) / snake_block) * snake_block

    # 蛇移动的距离
    x1_change = 0
    y1_change = 0

    snake_list = []
    length_of_snake = 1
    score = 0

    flash_frames = 0

    # 随机生成第一个食物位置
    foodx = (
        round(random.randrange(0, WIDTH - snake_block) / float(snake_block))
        * snake_block
    )
    foody = (
        round(random.randrange(0, HEIGHT - snake_block) / float(snake_block))
        * snake_block
    )

    # 金色食物状态
    golden_food_active = False
    golden_foodx = 0
    golden_foody = 0
    golden_food_timer = 0  # 金色食物剩余显示帧数

    while not game_over:

        while game_close:
            dis.fill(BLACK)
            # 仅在首次进入 game_close 时播放游戏结束音效
            if (
                not hasattr(game_loop, "_played_gameover")
                or not game_loop._played_gameover
            ):
                gameover_sound.play()
                game_loop._played_gameover = True
            show_message(
                "输了! 按 Q 退出 或 按 C 重玩",
                "You Lost! Press Q-Quit or C-Play Again",
                RED,
            )
            display_score(score)
            pygame.display.update()

            for event in pygame.event.get():
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_q:
                        game_over = True
                        game_close = False
                    if event.key == pygame.K_c:
                        game_loop._played_gameover = False
                        game_loop()
                        return
                elif event.type == pygame.QUIT:
                    game_over = True
                    game_close = False

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                game_over = True
            if event.type == pygame.KEYDOWN:
                # 按 P 键切换暂停状态
                if event.key == pygame.K_p:
                    paused = not paused
                # 阻止蛇直接反向移动
                elif event.key == pygame.K_LEFT and x1_change == 0:
                    x1_change = -snake_block
                    y1_change = 0
                elif event.key == pygame.K_RIGHT and x1_change == 0:
                    x1_change = snake_block
                    y1_change = 0
                elif event.key == pygame.K_UP and y1_change == 0:
                    y1_change = -snake_block
                    x1_change = 0
                elif event.key == pygame.K_DOWN and y1_change == 0:
                    y1_change = snake_block
                    x1_change = 0

        # 暂停状态：显示提示信息，跳过游戏逻辑
        if paused:
            show_message("游戏暂停中,按P键继续", "PAUSED - Press P to resume", YELLOW)
            pygame.display.update()
            clock.tick(5)
            continue

        # 判断是否撞墙
        if x1 >= WIDTH or x1 < 0 or y1 >= HEIGHT or y1 < 0:
            game_close = True

        x1 += x1_change
        y1 += y1_change

        if flash_frames > 0:
            dis.fill(WHITE)
            flash_frames -= 1
        else:
            dis.fill(BLACK)

        # 画普通食物
        pygame.draw.rect(dis, RED, [foodx, foody, snake_block, snake_block])

        # 画金色食物（比普通食物稍大，更醒目）
        if golden_food_active:
            pygame.draw.rect(
                dis,
                GOLD,
                [golden_foodx - 2, golden_foody - 2, snake_block + 4, snake_block + 4],
            )
            golden_food_timer -= 1
            if golden_food_timer <= 0:
                golden_food_active = False

        # 记录蛇头的位置信息
        snake_head = [x1, y1]
        snake_list.append(snake_head)

        # 保持蛇的长度对应当前的得分
        if len(snake_list) > length_of_snake:
            del snake_list[0]

        # 判断是否撞到自己
        for segment in snake_list[:-1]:
            if segment == snake_head:
                game_close = True

        draw_snake(snake_block, snake_list)
        display_score(score)

        # 如果金色食物存在，显示 x2 提示
        if golden_food_active:
            draw_multiplier_hint()

        pygame.display.update()

        # 判断是否吃到食物
        if x1 == foodx and y1 == foody:
            foodx = (
                round(random.randrange(0, WIDTH - snake_block) / float(snake_block))
                * snake_block
            )
            foody = (
                round(random.randrange(0, HEIGHT - snake_block) / float(snake_block))
                * snake_block
            )
            length_of_snake += 1
            eat_sound.play()  # 播放吃食物音效
            score += 1

            if score > 0 and score % 5 == 0:
                flash_frames = 2
                milestone_sound.play()  # 播放成就音效

            # 20% 概率生成金色食物
            if not golden_food_active and random.random() < 0.2:
                golden_foodx = (
                    round(random.randrange(0, WIDTH - snake_block) / float(snake_block))
                    * snake_block
                )
                golden_foody = (
                    round(
                        random.randrange(0, HEIGHT - snake_block) / float(snake_block)
                    )
                    * snake_block
                )
                golden_food_active = True
                golden_food_timer = 60  # 约5秒（12帧/秒 * 5）

        # 判断是否吃到金色食物（得分加倍：+2）
        if golden_food_active and x1 == golden_foodx and y1 == golden_foody:
            length_of_snake += 1
            score += 2  # 金色食物得分加倍
            eat_sound.play()
            golden_food_active = False
            flash_frames = 3  # 闪烁提示

        clock.tick(snake_speed)

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    game_loop()
