import { View, Text, Button } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState, useEffect, useRef } from "react";
import "./index.scss";

interface Balloon {
  id: number;
  expression: string;
  answer: number;
  x: number;
  y: number;
  isActive: boolean;
  hasCharacter: boolean; // 是否有小人
  isFloating: boolean; // 是否在飘浮状态
  isFalling: boolean; // 是否在下落状态
}

export default function BubbleGame() {
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [currentBalloonIndex, setCurrentBalloonIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(5);
  const [gameStatus, setGameStatus] = useState<'playing' | 'gameOver' | 'completed'>('playing');
  const [completedCount, setCompletedCount] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [gameTime, setGameTime] = useState(0);
  const [balloonOffset, setBalloonOffset] = useState(0); // 气球容器偏移量
  const [bestTime, setBestTime] = useState<number | null>(null); // 最佳时间
  const [balloonFalling, setBalloonFalling] = useState(false); // 气球下落状态
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 游戏难度配置
  const difficultyConfig = {
    easy: { range: 10, totalQuestions: 10, name: '简单' },
    medium: { range: 20, totalQuestions: 15, name: '中等' },
    hard: { range: 100, totalQuestions: 20, name: '困难' }
  };

  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [showDifficultySelect, setShowDifficultySelect] = useState(true);

  // 根据难度生成算式
  const generateExpression = () => {
    const config = difficultyConfig[difficulty];
    const a = Math.floor(Math.random() * config.range) + 1;
    const b = Math.floor(Math.random() * config.range) + 1;
    const isAdd = Math.random() > 0.5;
    
    if (isAdd) {
      const sum = a + b;
      if (sum <= config.range) {
        return { expression: `${a} + ${b}`, answer: sum };
      } else {
        // 如果加法结果超出范围，改为减法，确保结果为正数
        const larger = Math.max(a, b);
        const smaller = Math.min(a, b);
        return { expression: `${larger} - ${smaller}`, answer: larger - smaller };
      }
    } else {
      // 减法确保结果为正数
      const larger = Math.max(a, b);
      const smaller = Math.min(a, b);
      return { expression: `${larger} - ${smaller}`, answer: larger - smaller };
    }
  };

  // 初始化气球
  const initializeBalloons = () => {
    const newBalloons: Balloon[] = [];
    for (let i = 0; i < 15; i++) { // 增加到15个气球，确保有足够的气球
      const { expression, answer } = generateExpression();
      newBalloons.push({
        id: i,
        expression,
        answer,
        x: i * 120 + 60, // 气球间距
        y: 50, // 初始在天空中
        isActive: i < 3, // 只显示前3个
        hasCharacter: i === 0, // 第一个气球有小人
        isFloating: true, // 初始都在飘浮
        isFalling: false // 初始不下落
      });
    }
    setBalloons(newBalloons);
  };

  // 开始倒计时
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(5);
    
    // 开始有小人的气球下落
    setBalloons(prev => prev.map(balloon => 
      balloon.hasCharacter 
        ? { ...balloon, isFloating: false, isFalling: true }
        : balloon
    ));
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameStatus('gameOver');
          if (gameTimerRef.current) clearInterval(gameTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 开始游戏计时
  const startGameTimer = () => {
    setStartTime(Date.now());
    gameTimerRef.current = setInterval(() => {
      setGameTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
  };

  // 处理数字输入
  const handleNumberInput = (num: string) => {
    const currentBalloon = balloons[currentBalloonIndex];
    if (!currentBalloon) return;
    
    const newAnswer = userAnswer + num;
    const correctAnswer = currentBalloon.answer.toString();
    
    // 检查输入是否正确
    if (correctAnswer.startsWith(newAnswer)) {
      setUserAnswer(newAnswer);
      
      // 如果答案完整正确
      if (newAnswer === correctAnswer) {
        // 小人跳跃动画
        const characterElement = document.querySelector('.character') as HTMLElement;
        if (characterElement) {
          characterElement.classList.add('jumping');
          setTimeout(() => {
            characterElement.classList.remove('jumping');
          }, 500);
        }
        
        // 延迟处理下一个气球，让跳跃动画完成
        setTimeout(() => {
          handleCorrectAnswer();
        }, 300);
      }
    }
    // 如果输入错误，不更新答案框
  };

  // 数字按钮点击
  const handleNumberClick = (num: number) => {
    if (gameStatus !== 'playing') return;
    handleNumberInput(num.toString());
  };

  // 正确答案处理
  const handleCorrectAnswer = () => {
    const newCompletedCount = completedCount + 1;
    setCompletedCount(newCompletedCount);
    setUserAnswer("");
    
    const config = difficultyConfig[difficulty];
    if (newCompletedCount >= config.totalQuestions) {
      // 游戏完成
      setGameStatus('completed');
      const totalTime = Math.floor((Date.now() - startTime) / 1000);
      setGameTime(totalTime);
      
      // 保存到微信缓存，如果是新纪录则更新
      try {
        const storageKey = `bubbleGameBestTime_${difficulty}`;
        const currentBestTime = Taro.getStorageSync(storageKey);
        if (!currentBestTime || totalTime < currentBestTime) {
          Taro.setStorageSync(storageKey, totalTime);
          setBestTime(totalTime);
          Taro.showToast({
            title: '新纪录！',
            icon: 'success',
            duration: 2000
          });
        } else {
          Taro.setStorageSync('bubbleGameBestTime', currentBestTime);
        }
      } catch (error) {
        console.log('保存最佳时间失败:', error);
      }
      
      if (timerRef.current) clearInterval(timerRef.current);
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    } else {
      // 小人跳跃到下一个气球动画
       const characterElement = document.querySelector('.character') as HTMLElement;
       if (characterElement) {
         characterElement.style.animation = 'jumpToNextBalloon 1s ease-in-out';
         
         // 动画完成后重置
         setTimeout(() => {
           characterElement.style.animation = '';
         }, 1000);
       }
      
      // 延迟更新气球状态，让跳跃动画先执行
      setTimeout(() => {
        const nextIndex = currentBalloonIndex + 1;
        setCurrentBalloonIndex(nextIndex);
        
        // 更新气球状态：当前气球失去小人，下一个气球获得小人
        setBalloons(prev => prev.map(balloon => {
          if (balloon.id === currentBalloonIndex) {
            // 当前气球失去小人，停止下落
            return { 
              ...balloon, 
              hasCharacter: false, 
              isFloating: true, 
              isFalling: false 
            };
          } else if (balloon.id === nextIndex) {
            // 下一个气球获得小人，开始下落
            return { 
              ...balloon, 
              hasCharacter: true, 
              isFloating: false, 
              isFalling: true 
            };
          }
          return balloon;
        }));
        
        // 重置倒计时
        setTimeLeft(5);
        
        // 画面左移动画
        setBalloonOffset(prev => prev - 120);
        
        // 更新气球显示状态
        setBalloons(prev => prev.map((balloon, index) => ({
          ...balloon,
          isActive: index >= nextIndex && index < nextIndex + 3
        })));
      }, 500); // 延迟500ms，让跳跃动画先执行一半
      
      startTimer();
    }
  };

  // 清除答案
  const clearAnswer = () => {
    setUserAnswer("");
  };

  // 开始游戏（选择难度后）
  const startGame = (selectedDifficulty: 'easy' | 'medium' | 'hard') => {
    setDifficulty(selectedDifficulty);
    setShowDifficultySelect(false);
    setGameStatus('playing');
    setCurrentBalloonIndex(0);
    setCompletedCount(0);
    setUserAnswer("");
    setGameTime(0);
    setBalloonOffset(0);
    setBalloonFalling(false);
    initializeBalloons();
    startTimer();
    startGameTimer();
  };

  // 重新开始游戏
  const restartGame = () => {
    setShowDifficultySelect(true);
    setGameStatus('playing');
    setCurrentBalloonIndex(0);
    setCompletedCount(0);
    setUserAnswer("");
    setGameTime(0);
    setBalloonOffset(0);
    setBalloonFalling(false);
    // 重置难度相关状态，确保重新选择难度时生效
    setBalloons([]);
    setTimeLeft(0);
    setBestTime(0);
  };

  useLoad(() => {
    console.log("Bubble game loaded.");
    
    // 加载最佳时间
    try {
      const storageKey = `bubbleGameBestTime_${difficulty}`;
      const savedBestTime = Taro.getStorageSync(storageKey);
      if (savedBestTime) {
        setBestTime(savedBestTime);
      }
    } catch (error) {
      console.log('获取最佳时间失败:', error);
    }
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    };
  }, []);

  return (
    <View className="bubble-game">
      {/* 难度选择界面 */}
      {showDifficultySelect && (
        <View className="difficulty-select">
          <View className="difficulty-modal">
            <Text className="difficulty-title">选择游戏难度</Text>
            <View className="difficulty-options">
              {Object.entries(difficultyConfig).map(([key, config]) => (
                <Button
                  key={key}
                  className="difficulty-btn"
                  onClick={() => startGame(key as 'easy' | 'medium' | 'hard')}
                >
                  <Text className="difficulty-name">{config.name}</Text>
                  <Text className="difficulty-desc">
                    {config.range}以内 · {config.totalQuestions}题
                  </Text>
                </Button>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* 游戏界面 */}
      {!showDifficultySelect && (
        <>
          {/* 背景 */}
          <View className="game-background">
            {/* 天空背景 */}
            <View className="sky"></View>
            
            {/* 游戏信息 */}
            <View className="game-info">
              <Text className="time-left">时间: {timeLeft}s</Text>
              <Text className="progress">进度: {completedCount}/{difficultyConfig[difficulty].totalQuestions}</Text>
              {bestTime && <Text className="best-time">最佳: {bestTime}s</Text>}
            </View>

        {/* 气球区域 */}
        <View className="balloons-container">
          {/* 渲染气球 */}
          {balloons.filter(balloon => balloon.isActive).map((balloon) => (
            <View
              key={balloon.id}
              className={`balloon-wrapper ${balloon.isFloating ? 'floating' : ''} ${balloon.isFalling ? 'falling' : ''}`}
              style={{
                left: `${balloon.x + balloonOffset}px`,
                top: `${balloon.y}px`
              }}
            >
              {/* 气球 */}
               <View 
                 className={`balloon ${balloon.hasCharacter ? 'with-character' : ''}`}
               >
                 <Text className="balloon-text">{balloon.expression}</Text>
               </View>
              
              {/* 气球线 */}
              <View className="balloon-string"></View>
              
              {/* 小人（如果有的话） */}
              {balloon.hasCharacter && (
                <View className="character">
                  <View className="character-arm"></View>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* 答案区域 */}
        <View className="answer-section">
          <View className="answer-box">
            <Text className="answer-text">{userAnswer || "?"}</Text>
          </View>
        </View>

        {/* 数字按钮 */}
        <View className="number-buttons">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(num => (
            <Button
              key={num}
              className="number-btn large"
              onClick={() => handleNumberClick(num)}
              disabled={gameStatus !== 'playing'}
            >
              {num}
            </Button>
          ))}
        </View>

        {/* 游戏结束弹窗 */}
        {gameStatus === 'completed' && (
          <View className="game-modal">
            <View className="modal-content">
              <Text className="modal-title">🎉 恭喜过关！</Text>
              <Text className="modal-text">用时: {gameTime}秒</Text>
              {bestTime && gameTime === bestTime && (
                <Text className="modal-text new-record">🏆 新纪录！</Text>
              )}
              {bestTime && gameTime !== bestTime && (
                <Text className="modal-text">最佳纪录: {bestTime}秒</Text>
              )}
              <Button className="modal-button" onClick={restartGame}>
                再来一局
              </Button>
            </View>
          </View>
        )}

        {gameStatus === 'gameOver' && (
          <View className="game-modal">
            <View className="modal-content">
              <Text className="modal-title">😢 游戏结束</Text>
              <Text className="modal-text">时间到了！</Text>
              {bestTime && (
                <Text className="modal-text">最佳纪录: {bestTime}秒</Text>
              )}
              <Button className="modal-button" onClick={restartGame}>
                重新开始
              </Button>
            </View>
          </View>
        )}
          </View>
        </>
      )}
    </View>
  );
}