// Мы ожидаем, что Вы исправите синтаксические ошибки, сделаете перехват возможных исключений и улучшите читаемость кода.
// А так же, напишите кастомный хук useThrottle и используете его там где это нужно.
// Желательно использование React.memo и React.useCallback там где это имеет смысл.
// Будет большим плюсом, если Вы сможете закэшировать получение случайного пользователя.
// Укажите правильные типы.
// По возможности пришлите Ваш вариант в https://codesandbox.io

// сделала все кавычки кроме строковых пропсов одинарными для единого стиля 
import React, { useRef, useState, useCallback } from 'react';

const URL = 'https://jsonplaceholder.typicode.com/users';

type Company = {
  bs: string;
  catchPhrase: string;
  name: string;
};

// добавила тип Address для свойства 'address', принадлежащего типу 'User'
type Address = {
  city: string;
  geo: { lat: string, lng: string };
  street: string;
  suite: string;
  zipcode: string;
};

type User = {
  id: number;
  email: string;
  name: string;
  phone: string;
  username: string;
  website: string;
  company: Company;
  // описала тип свойства 'address' и добавила ';' в конце
  address: Address;
};

interface IButtonProps {
  // добавила описание метода 'onClick'
  onClick(event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
}

// поправила описание типа, возвращаемого компонентом 'Button'
function Button({ onClick }: IButtonProps): React.ReactElement {
  return (
    <button type="button" onClick={onClick}>
      get random user
    </button>
  );
}

// замемоизировала компонент,
// чтобы он не перерендерился при изменении информации о пользователе
const MemorizedButton = React.memo(Button);

interface IUserInfoProps {
  user: User;
}

// поправила описание типа, возвращаемого компонентом 'UserInfo'
function UserInfo({ user }: IUserInfoProps): React.ReactElement {
  return (
    <table>
      <thead>
        <tr>
          <th>Username</th>
          <th>Phone number</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{user.name}</td>
          <td>{user.phone}</td>
        </tr>
      </tbody>
    </table>
  );
}

// функция useThrottle для уменьшения количества запросов пользователей
function useThrottle({ pauseSeconds, callback }: { pauseSeconds: number, callback(): void }) {
  const isThrottledRef = useRef<boolean>(false);

  // мемоизирую зависимость функции handleButtonClick
  return useCallback<() => Promise<void>>(() => {
    if (isThrottledRef.current) {
      // если с последнего нажатия на кнопку прошло мало времени,
      // то генерация пользователя отменяется
      return;
    }

    // начинаем отсчет 'pauseSeconds' секунд после вызова генерации пользователя
    isThrottledRef.current = true;
    setTimeout(() => {
      isThrottledRef.current = false;
    }, pauseSeconds * 1000);

    callback();
  }, [callback, pauseSeconds]);
}

// поправила описание типа, возвращаемого компонентом 'App'
function App(): React.ReactElement {
  // поправила описание типа стейта 'item'
  const [item, setItem] = useState<User | null>(null);

  // добавила ref для предотвращения race conditions
  // при одновременных запросах пользователей,
  // которые могут возникнуть например при медленном интернете
  const lastItemIdRef = useRef<number | null>(null);

  // Добавила ref для кеширования полученных пользователей
  // Сделала на рефе, а не на стейте, т.к. значение не используется для рендеринга
  // Поэтому ему можно быть НЕ реактивным
  const cachedUsersRef = useRef<Record<number, User>>({});

  // мемоизирую зависимость функции throttledReceiveRandomUser
  const receiveRandomUser = useCallback<() => Promise<void>>(async () => {
    const id = Math.floor(Math.random() * (10 - 1)) + 1;

    // Запоминание id последнего запрошенного пользователя
    lastItemIdRef.current = id;

    // Перед запросом пользователя, проверяю, нет ли его в кеше 
    const cachedUser: User | undefined = cachedUsersRef.current[id];
    if (cachedUser) {
      // Если пользователь есть в кеше, то кладу в стейт значение из кеша
      setItem(cachedUser);
      return;
    }

    // обернула в try catch, т.к. при запросе и парсинге json'а могут быть exceptions
    try {
      const response = await fetch(`${URL}/${id}`);
      const _user = (await response.json()) as User;

      // После запроса пользователя, проверяю, не появился ли пользователь в кеше, пока шел запрос
      const cachedUser: User | undefined = cachedUsersRef.current[id];

      if (!cachedUser) {
        // Если пока шел запрос, пользователь НЕ появился в кеше, 
        // то добавляем полученное с сервера значение в кеш
        cachedUsersRef.current = {
          ...cachedUsersRef.current,
          [id]: _user
        };
      }

      // Проверяем, не была нажата ли кнопка генерации пользователя еще раз,
      // пока шел запрос
      if (lastItemIdRef.current !== id) {
        return;
      }

      // Если кнопка не была нажата и ожидается отображение пользователя с тем же id,
      // то кладу в стейт либо значение из кеша, либо значение полученное с сервера
      setItem(cachedUser ? cachedUser : _user);
    } catch (e) {
      // при возникновении исключения сбрасываю значение пользователя
      setItem(null);
      return
    }
  }, []);

  const throttledReceiveRandomUser = useThrottle({ pauseSeconds: 10, callback: receiveRandomUser });

  // мемоизирую пропс handleButtonClick компонента MemorizedButton,
  // чтобы функция handleButtonClick менялась, 
  // только когда меняется зависимость throttledReceiveRandomUser,
  // а не при любом рендере App.
  // Это позволит уменьшить количество перерендеров MemorizedButton,
  // т.к. мемоизированный компонент MemorizedButton перерендеривается
  // только при изменении пропса handleButtonClick
  const handleButtonClick = useCallback<(
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => void>(event => {
    event.stopPropagation();
    throttledReceiveRandomUser();
  }, [throttledReceiveRandomUser]);

  // использовала мемоизированный компонент MemorizedButton вместо Button
  // добавила скрытие информации о пользователи, если значение стейта item равно null
  return (
    <div>
      <header>Get a random user</header>
      <MemorizedButton onClick={handleButtonClick} />
      {item && (
        <UserInfo user={item} />
      )}
    </div>
  );
}

export default App;

// для лучшей читаемости я бы разбира компоненты на файлы,
// хук useThrottle тоже вынесла бы в отдельный файл
