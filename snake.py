import pygame
import time
import random
import sys
import math
import struct
import wave
import io

# 初始化 pygame
pygame.init()
pygame.mixer.init(frequency=22050, size=-16, channels=1, buffer=512)

def generate_sound(frequency=440, duration=0.15, volume=0.5, sample_rate=22050):
    """通过正弦波动态生成音效，无需外部音频文件"""
    n_samples = int(sample_rate * duration)
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        for i in range(n_samples):
            # 使用衰减包络让声音更自然
            envelope = max(0, 1.0 - (i / n_samples) * 1.5)
            val = int(volume * 32767 * envelope * math.sin(2 * math.pi * frequency * i / sample_rate))
            wf.writeframes(struct.pack('<h', max(-32768, min(32767, val))))
    buf.seek(0)
    return pygame.mixer.Sound(buf)

# 生成音效
eat_sound = generate_sound(frequency=880, duration=0.1, volume=0.4)       # 吃食物：短促高音
milestone_sound = generate_sound(frequency=1200, duration=0.3, volume=0.5) # 达到5倍数：成就音
gameover_sound = generate_sound(frequency=200, duration=0.5, volume=0.6)   # 游戏结束：低沉音

# 定义颜色常量
WHITE = (255, 255, 255)
YELLOW = (255, 255, 102)
BLACK = (0, 0, 0)
RED = (213, 50, 80)
GREEN = (0, 255, 0)
BLUE = (50, 153, 213)

# 设置屏幕大小
WIDTH = 600
HEIGHT = 400

# 创建游戏窗口
dis = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption('贪吃蛇 - Python/Pygame')

clock = pygame.time.Clock()
snake_block = 15
snake_speed = 12

# 匹配系统中存在的支持中文的字体
font_name = pygame.font.match_font(['simhei', 'microsoftyahei', 'dengxian', 'fangsong', 'simsun'])
if font_name is None:
    font_style = pygame.font.Font(None, 30)
    score_font = pygame.font.Font(None, 40)
    is_chinese_supported = False
else:
    font_style = pygame.font.Font(font_name, 30)
    score_font = pygame.font.Font(font_name, 40)
    is_chinese_supported = True

def Your_score(score):
    if is_chinese_supported:
        value = score_font.render("得分: " + str(score), True, YELLOW)
    else:
        value = score_font.render("Score: " + str(score), True, YELLOW)
    dis.blit(value, [10, 10])

def our_snake(snake_block, snake_list):
    for x in snake_list:
        pygame.draw.rect(dis, GREEN, [x[0], x[1], snake_block, snake_block])

def message(msg, english_msg, color):
    if is_chinese_supported:
        mesg = font_style.render(msg, True, color)
    else:
        mesg = font_style.render(english_msg, True, color)
    msg_rect = mesg.get_rect(center=(WIDTH/2, HEIGHT/2))
    dis.blit(mesg, msg_rect)

def gameLoop():
    game_over = False
    game_close = False
    paused = False

    # 蛇的初始位置
    x1 = round((WIDTH / 2) / snake_block) * snake_block
    y1 = round((HEIGHT / 2) / snake_block) * snake_block

    # 蛇移动的距离
    x1_change = 0
    y1_change = 0

    snake_List = []
    Length_of_snake = 1
    
    flash_frames = 0

    # 随机生成第一个食物位置
    foodx = round(random.randrange(0, WIDTH - snake_block) / float(snake_block)) * snake_block
    foody = round(random.randrange(0, HEIGHT - snake_block) / float(snake_block)) * snake_block

    while not game_over:

        while game_close == True:
            dis.fill(BLACK)
            # 仅在首次进入 game_close 时播放游戏结束音效
            if not hasattr(gameLoop, '_played_gameover') or not gameLoop._played_gameover:
                gameover_sound.play()
                gameLoop._played_gameover = True
            message("输了! 按 Q 退出 或 按 C 重玩", "You Lost! Press Q-Quit or C-Play Again", RED)
            Your_score(Length_of_snake - 1)
            pygame.display.update()

            for event in pygame.event.get():
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_q:
                        game_over = True
                        game_close = False
                    if event.key == pygame.K_c:
                        gameLoop._played_gameover = False
                        gameLoop()
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
            message("游戏暂停中,按P键继续", "PAUSED - Press P to resume", YELLOW)
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
        
        # 画食物
        pygame.draw.rect(dis, RED, [foodx, foody, snake_block, snake_block])
        
        # 记录蛇头的位置信息
        snake_Head = []
        snake_Head.append(x1)
        snake_Head.append(y1)
        snake_List.append(snake_Head)
        
        # 保持蛇的长度对应当前的得分
        if len(snake_List) > Length_of_snake:
            del snake_List[0]

        # 判断是否撞到自己
        for x in snake_List[:-1]:
            if x == snake_Head:
                game_close = True

        our_snake(snake_block, snake_List)
        Your_score(Length_of_snake - 1)

        pygame.display.update()

        # 判断是否吃到食物
        if x1 == foodx and y1 == foody:
            foodx = round(random.randrange(0, WIDTH - snake_block) / float(snake_block)) * snake_block
            foody = round(random.randrange(0, HEIGHT - snake_block) / float(snake_block)) * snake_block
            Length_of_snake += 1
            eat_sound.play()  # 播放吃食物音效
            
            score = Length_of_snake - 1
            if score > 0 and score % 5 == 0:
                flash_frames = 2
                milestone_sound.play()  # 播放成就音效

        clock.tick(snake_speed)

    pygame.quit()
    sys.exit()

if __name__ == '__main__':
    gameLoop()
